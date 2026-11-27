import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Download, type Locator, type Page } from "@playwright/test";
import { activateFromEmail, enrolTotp, pdf, signInAsAdmin, sql, vnDate } from "./support";

/**
 * Spec #79 step 5 (#92): L16, L17 and L22 through the real stack (Gotenberg included), one role per browser. Three hồ sơ
 * of one Phiên họp are chốt at 4 sao, 5 sao and 1 sao; from there the Thư ký writes the Nhận xét chung, the Sở records
 * the Quyết định công nhận, uploads the signed Giấy chứng nhận, phát hành the Thư kết quả không đạt, takes the hồ sơ 5
 * sao through the Bộ and back to a Quyết định công nhận bổ sung, and exports both Excel lists; the Chủ thể sees its kết
 * quả only once công bố and never a thành viên; the Quản trị round-trips a mẫu văn bản. The rules themselves are covered
 * by the use-case and permission-matrix tests in packages/infra/test/results.
 *
 * Getting to Đã chốt điểm is the journey of hoi-dong-va-cham-diem.spec.ts, shortened: one đợt Chấm trực tiếp, two
 * thành viên, and Xác thực lại passed by a recent sign-in (that spec walks the step-up itself).
 */

const stamp = Date.now();
/** From packages/infra/seed/wards.sample.csv, seeded by the global setup. */
const WARD = { name: "Xã Mẫu Đồng Xanh", code: "90003" };
const LEGAL_BASIS = `E2E KQ ${stamp}/2026/QĐ-TTg`;
const SET_NAME = "Đồ uống KQ E2E";
const PASSWORD = "mat-khau-e2e-12345";
const COUNCIL = `Hội đồng kết quả E2E ${stamp}`;
const ROUND = `Đợt kết quả E2E ${stamp}`;
const GENERAL_COMMENT = `Sản phẩm có vùng nguyên liệu ổn định, cần mở rộng liên kết (${stamp}).`;
const ADVICE = "Hoàn thiện hợp đồng liên kết sản xuất với các hộ trong vùng.";

interface Person {
  email: string;
  fullName: string;
}
const person = (slug: string, fullName: string): Person => ({ email: `${slug}.${stamp}@ocop.local`, fullName: `${fullName} ${stamp}` });
const owner = {
  ...person("kq.chu.the", "Hợp tác xã Kết Quả"),
  identifier: String(stamp + 11)
    .padStart(12, "0")
    .slice(-12),
};
const wardOfficer = person("kq.can.bo.xa", "Cán bộ xã KQ");
const provinceOfficer = person("kq.can.bo.so", "Cán bộ Sở KQ");
const chair = person("kq.chu.tich", "Chủ tịch KQ");
const secretary = person("kq.thu.ky", "Thư ký KQ");
const m1 = person("kq.tv1", "Thành viên KQ Một");
const m2 = person("kq.tv2", "Thành viên KQ Hai");

/** The three hồ sơ, by the points both thành viên give Tiêu chí 1.1 and 1.2 (Ngưỡng hạng 30/50/70/90). */
const FIVE = { product: `Nước ép dứa E2E ${stamp}`, points: [50, 50] as const };
const FOUR = { product: `Trà gừng E2E ${stamp}`, points: [50, 25] as const };
const ONE = { product: `Sữa đậu E2E ${stamp}`, points: [25, 0] as const };
const PRODUCTS = [FIVE, FOUR, ONE];

/** A one-set Phiên bản tiêu chí in the QĐ 26 extraction format: two Tiêu chí of 50 points (the import adds the 0 level). */
const criteriaJson = () => {
  const criterion = (ma: string, ten: string) => ({
    phan: "A",
    phan_ten: "SẢN PHẨM VÀ SỨC MẠNH CỘNG ĐỒNG",
    phan_diem: 100,
    muc: "1",
    muc_ten: "TỔ CHỨC SẢN XUẤT",
    muc_diem: 100,
    ma,
    ten,
    diem_toi_da: 50,
    yeu_cau: "",
    ghi_chu: "",
    lua_chon: [
      { thu_tu: 1, mo_ta: "Đạt một phần", diem: 25, sao_toi_thieu: null },
      { thu_tu: 2, mo_ta: "Đạt đầy đủ", diem: 50, sao_toi_thieu: null },
    ],
  });
  return JSON.stringify({
    van_ban: LEGAL_BASIS,
    ngay_ban_hanh: "2026-01-04",
    hieu_luc: "2026-02-01",
    bo_tieu_chi: [
      {
        bo: 1,
        ten_bo: SET_NAME,
        san_pham: "Đồ uống",
        nhom: "Đồ uống không cồn",
        ghi_chu_dau_phieu: "",
        tong_diem: 100,
        tieu_chi: [criterion("1.1", "Nguồn nguyên liệu"), criterion("1.2", "Liên kết sản xuất")],
      },
    ],
  });
};

// A step that never arrives fails within a minute rather than at the end of the long journey.
test.use({ navigationTimeout: 60_000, actionTimeout: 60_000 });

async function newPage(browser: Browser) {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  // window.confirm guards Giao chấm, ghi nhận quyết định, phát hành thư and similar one-click actions.
  page.on("dialog", (d) => void d.accept());
  return page;
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name, exact: true }).click();
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const openRow = (page: Page, product: string) => page.getByRole("row").filter({ hasText: product }).getByRole("link").first().click();

/** Clicks `trigger` and returns the download it starts, checked for a name matching `name` and some content. */
async function download(page: Page, trigger: Locator, name: RegExp): Promise<Download> {
  const [file] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  expect(await file.failure()).toBeNull();
  expect(file.suggestedFilename()).toMatch(name);
  expect(readFileSync((await file.path())!).length).toBeGreaterThan(0);
  return file;
}

/** Every XML part of a downloaded .xlsx, as text: enough to see which rows it holds. */
const xlsxText = async (file: Download) => execFileSync("unzip", ["-p", (await file.path())!, "xl/*"], { encoding: "utf8" });

/**
 * Xác thực lại (ADR 0003) is walked by hoi-dong-va-cham-diem.spec.ts; here the sign-in of `who` is made recent instead,
 * so the many Xác nhận phiếu and chốt điểm need no fresh TOTP step each (codes are single-use per 30 seconds).
 */
function recentlyAuthenticated(who: Person) {
  sql(
    `UPDATE identity.session SET authenticated_at = now() WHERE revoked_at IS NULL AND user_id = (SELECT id FROM identity.user_account WHERE email = '${who.email}')`,
  );
}

test("L16, L17, L22 the Sở records the kết quả, the hồ sơ 5 sao goes to the Bộ and back, the Chủ thể sees it", async ({ page: adminPage, browser }) => {
  test.setTimeout(1_800_000);

  // ---------------------------------------------------------------------------------------------------------
  // Up to Đã chốt điểm (L01 to L15)
  // ---------------------------------------------------------------------------------------------------------

  await test.step("Quản trị publishes a Phiên bản tiêu chí and creates the Sở and xã officers", async () => {
    await signInAsAdmin(adminPage);
    await nav(adminPage, "Bộ tiêu chí");
    await adminPage.getByLabel(/Tệp JSON/).setInputFiles({ name: "tieu-chi-kq-e2e.json", mimeType: "application/json", buffer: Buffer.from(criteriaJson()) });
    await adminPage.getByRole("button", { name: "Nhập thành bản nháp" }).click();
    await adminPage.getByRole("status").getByRole("link", { name: "Mở bản nháp" }).click();
    await adminPage.getByRole("button", { name: "Phát hành" }).click();
    await adminPage.getByRole("dialog", { name: "Phát hành phiên bản tiêu chí?" }).getByRole("button", { name: "Phát hành" }).click();
    await expect(adminPage.getByText("Đã phát hành").first()).toBeVisible();
    await createStaff(adminPage, wardOfficer, "Cán bộ xã", `${WARD.name} (${WARD.code})`);
    await createStaff(adminPage, provinceOfficer, "Cán bộ Sở");
  });

  const provincePage = await newPage(browser);
  await test.step("The Cán bộ Sở records the Hội đồng; the Quản trị grants its Phân vai", async () => {
    await activateFromEmail(provincePage, provinceOfficer.email, PASSWORD);
    await enrolTotp(provincePage);
    await provincePage.waitForURL("/");
    await nav(provincePage, "Hội đồng");
    await provincePage.getByLabel("Tên hội đồng").fill(COUNCIL);
    await provincePage.getByLabel("Số quyết định thành lập").fill(`${stamp % 1000}/QĐ-UBND-KQ`);
    await provincePage.getByLabel("Ngày quyết định").fill(vnDate(-30));
    await provincePage.getByLabel("Tệp quyết định").setInputFiles(pdf("Quyet-dinh-thanh-lap-hoi-dong.pdf"));
    await provincePage.getByRole("button", { name: "Ghi nhận hội đồng" }).click();
    await provincePage.waitForURL(/\/so\/hoi-dong\/[0-9a-f-]{36}$/);
    const council = new RegExp(`^${COUNCIL}`);
    await createStaff(adminPage, chair, "Chủ tịch hội đồng", council);
    await createStaff(adminPage, secretary, "Thư ký hội đồng", council);
    for (const m of [m1, m2]) await createStaff(adminPage, m, "Thành viên hội đồng", council);
  });

  const pages = new Map<string, Page>();
  await test.step("Every Phân vai holder activates and enrols TOTP", async () => {
    for (const who of [chair, secretary, m1, m2]) {
      const page = await newPage(browser);
      await activateFromEmail(page, who.email, PASSWORD);
      await enrolTotp(page);
      await page.waitForURL("/");
      pages.set(who.email, page);
    }
  });
  const pageOf = (who: Person) => pages.get(who.email)!;
  const secretaryPage = pageOf(secretary);

  await test.step("The Sở opens a đợt Chấm trực tiếp with 2 người chấm tối thiểu and gán the Hội đồng", async () => {
    // A đợt left Đang nhận nộp by an earlier journey would block Mở đợt.
    sql("UPDATE round.round SET submission_deadline = now() - interval '1 day' WHERE status = 'open_for_submission'");
    await nav(provincePage, "Đợt đánh giá");
    await provincePage.getByRole("link", { name: /Tạo đợt/ }).click();
    await provincePage.getByLabel("Tên đợt").fill(ROUND);
    await provincePage.getByLabel("Hạn nộp xã").fill(vnDate(20));
    await provincePage.getByLabel("Hạn gửi tỉnh").fill(vnDate(40));
    await provincePage.getByLabel("Hạn đánh giá tỉnh").fill(vnDate(60));
    await provincePage.getByLabel("Phiên bản tiêu chí").selectOption({ label: `${LEGAL_BASIS} (ban hành 04/01/2026)` });
    await provincePage.getByRole("radio", { name: /Chấm trực tiếp/ }).check();
    await provincePage.getByLabel("Số người chấm tối thiểu").fill("2");
    await provincePage.getByRole("button", { name: "Tạo đợt (Nháp)" }).click();
    await provincePage.getByRole("button", { name: "Mở đợt" }).click();
    await expect(provincePage.getByText("Đang nhận nộp").first()).toBeVisible();
    await provincePage.locator("select[name=councilId]").selectOption({ label: COUNCIL });
    await provincePage.getByRole("button", { name: "Gán hội đồng" }).click();
    await expect(provincePage.getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
  });

  const ownerPage = await newPage(browser);
  const ownerUrls: Record<string, string> = {};
  await test.step("A Chủ thể registers, adds its giấy tờ pháp lý and nộp three hồ sơ", async () => {
    await ownerPage.goto("/dang-ky");
    await ownerPage.getByText("Hộ sản xuất", { exact: true }).click();
    await ownerPage.getByLabel("Họ tên chủ hộ").fill(owner.fullName);
    await ownerPage.getByLabel("Số định danh cá nhân của chủ hộ").fill(owner.identifier);
    await ownerPage.getByLabel("Xã/phường").selectOption({ label: WARD.name });
    await ownerPage.getByLabel("Địa chỉ").fill(`Ấp 3, ${WARD.name}`);
    await ownerPage.getByLabel("Người đại diện").fill(owner.fullName);
    await ownerPage.getByLabel("Số điện thoại").fill("0907654322");
    await ownerPage.getByLabel("Email").fill(owner.email);
    await ownerPage.getByLabel(/Tôi đồng ý/).check();
    await ownerPage.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(ownerPage.getByRole("heading", { name: "Kiểm tra hộp thư của bạn" })).toBeVisible();
    await activateFromEmail(ownerPage, owner.email, PASSWORD);
    await ownerPage.waitForURL("/");
    await nav(ownerPage, "Hồ sơ pháp lý");
    await ownerPage.getByLabel("Loại giấy tờ").selectOption({ label: "Giấy chứng nhận đăng ký doanh nghiệp, hợp tác xã hoặc hộ kinh doanh" });
    await ownerPage.getByLabel("Số giấy tờ").fill("HKD-KQ-01");
    await ownerPage.getByLabel("Ngày cấp").fill("2025-03-15");
    await ownerPage.getByLabel("Tệp giấy tờ").setInputFiles(pdf("Giay-dang-ky-ho-kinh-doanh.pdf"));
    await ownerPage.getByRole("button", { name: "Thêm giấy tờ" }).click();
    await expect(ownerPage.getByTestId("verified")).toBeVisible({ timeout: 90_000 });

    for (const { product } of PRODUCTS) {
      await nav(ownerPage, "Hồ sơ của tôi");
      await ownerPage.getByRole("link", { name: "Tạo hồ sơ" }).click();
      await ownerPage.getByRole("radio", { name: new RegExp(SET_NAME) }).check();
      await ownerPage.getByLabel("Tôi đã hiểu").check();
      await ownerPage.getByRole("button", { name: "Tạo hồ sơ" }).click();
      await ownerPage.waitForURL(/\/chu-the\/ho-so\/[0-9a-f-]{36}$/);
      ownerUrls[product] = new URL(ownerPage.url()).pathname;
      await ownerPage.getByLabel("Tên sản phẩm").fill(product);
      await ownerPage.getByLabel("Mô tả sản phẩm").fill(`${product} của hộ sản xuất`);
      await ownerPage.getByLabel("Nguyên liệu").fill("Nguyên liệu tại địa phương");
      await ownerPage.getByLabel("Quy trình sản xuất").fill("Sơ chế, chế biến, đóng chai");
      await ownerPage.getByLabel("Bao bì, nhãn mác").fill("Chai thủy tinh 500 ml");
      await ownerPage.getByLabel("Công bố chất lượng").fill("Tự công bố số 03/2026");
      await ownerPage.getByLabel("Công bố chất lượng").blur();
      await expect(ownerPage.getByTestId("autosave-status")).toHaveText("Đã lưu tự động.");
      await ownerPage.getByLabel("Tệp minh chứng").setInputFiles(pdf("Hop-dong-nguyen-lieu.pdf"));
      await ownerPage.getByRole("button", { name: "Tải lên" }).click();
      await expect(ownerPage.getByText("Đã quét sạch")).toBeVisible({ timeout: 90_000 });
      await ownerPage.getByText("Gắn với tiêu chí").click();
      await ownerPage.getByRole("checkbox", { name: /1\.1 Nguồn nguyên liệu/ }).check();
      await ownerPage.getByRole("button", { name: "Lưu gắn tiêu chí" }).click();
      await expect(ownerPage.getByText(/Gắn với tiêu chí 1\.1/)).toBeVisible();
      const levels = ownerPage.getByLabel("Mức điểm tự chấm");
      await levels.nth(0).selectOption({ label: "Đạt đầy đủ · 50 điểm" });
      await expect(levels.nth(0)).toBeEnabled();
      await levels.nth(1).selectOption({ label: "Đạt đầy đủ · 50 điểm" });
      await expect(ownerPage.getByLabel("Ước lượng hạng sao")).toContainText("Tổng điểm: 100");
      await ownerPage.getByRole("button", { name: "Nộp hồ sơ" }).click();
      await expect(heading(ownerPage)).toContainText("Đã nộp xã");
    }
  });

  await test.step("The Cán bộ xã Tiếp nhận, assesses and gửi tỉnh the three hồ sơ", async () => {
    const wardPage = await newPage(browser);
    await activateFromEmail(wardPage, wardOfficer.email, PASSWORD);
    await wardPage.waitForURL("/");
    for (const { product } of PRODUCTS) {
      await nav(wardPage, "Hồ sơ tại xã");
      await wardPage.getByRole("link", { name: product }).click();
      await wardPage.waitForURL(/\/xa\/ho-so\/[0-9a-f-]{36}$/);
      const url = new URL(wardPage.url()).pathname;
      await wardPage.getByRole("button", { name: "Tiếp nhận" }).click();
      await expect(wardPage.getByText(/Đã tiếp nhận lúc/)).toBeVisible();
      const items = wardPage.getByRole("group", { name: /Kết quả mục/ });
      const count = await items.count();
      for (let i = 0; i < count; i++) await items.nth(i).getByLabel("Đạt", { exact: true }).check();
      await wardPage.getByRole("button", { name: "Lưu Checklist sơ bộ" }).click();
      await expect(wardPage.getByText("Đủ điều kiện chuyển tỉnh").first()).toBeVisible();
      await wardPage.getByRole("link", { name: "Lập báo cáo và gửi lên tỉnh" }).click();
      await wardPage.getByLabel(/Tải lên bản đã ký/).setInputFiles(pdf("Bao-cao-xa-da-ky.pdf"));
      await wardPage.getByRole("button", { name: "Tải lên", exact: true }).click();
      await expect(wardPage.getByRole("button", { name: "Tải bản đã ký (.pdf)" })).toBeVisible({ timeout: 90_000 });
      await wardPage.getByRole("button", { name: "Gửi lên tỉnh" }).click();
      await wardPage.getByRole("button", { name: "Xác nhận gửi" }).click();
      await wardPage.waitForURL(url);
      await expect(heading(wardPage)).toContainText("Đã chuyển tỉnh");
    }
  });

  const ids: Record<string, string> = {};
  await test.step("The Cán bộ Sở Tiếp nhận tại tỉnh the three hồ sơ", async () => {
    for (const { product } of PRODUCTS) {
      await nav(provincePage, "Hồ sơ toàn tỉnh");
      await provincePage.getByRole("link", { name: /Chờ tiếp nhận/ }).click();
      await provincePage.getByRole("link", { name: product }).click();
      await provincePage.waitForURL(/\/so\/ho-so\/[0-9a-f-]{36}$/);
      ids[product] = new URL(provincePage.url()).pathname.split("/").at(-1)!;
      await provincePage.getByRole("button", { name: "Tiếp nhận tại tỉnh" }).click();
      await expect(provincePage.getByText(/Đã tiếp nhận tại tỉnh lúc/)).toBeVisible();
    }
  });
  const idOf = (d: { product: string }) => ids[d.product]!;

  await test.step("The Thư ký Phân công both thành viên on each hồ sơ and Giao chấm", async () => {
    for (const { product } of PRODUCTS) {
      await nav(secretaryPage, "Phân công");
      const row = secretaryPage.getByTestId("assignment-row").filter({ hasText: product });
      await row.getByRole("checkbox").check();
      const picker = secretaryPage.getByRole("group", { name: /^Thành viên chấm/ });
      for (const m of [m1, m2]) await picker.getByLabel(m.fullName).check();
      await secretaryPage.getByRole("button", { name: "Lưu Phân công nháp" }).click();
      await expect(secretaryPage.getByText("Đã lưu Phân công nháp cho 1 hồ sơ.")).toBeVisible();
      await secretaryPage.getByRole("button", { name: "Giao chấm" }).click();
      await expect(secretaryPage.getByTestId("graded-row").filter({ hasText: product })).toBeVisible();
    }
  });

  await test.step("Both thành viên chấm and xác nhận the three hồ sơ", async () => {
    for (const who of [m1, m2]) {
      const p = pageOf(who);
      for (const { product, points } of PRODUCTS) {
        await nav(p, "Hồ sơ được phân công");
        await openRow(p, product);
        await p.waitForURL(/\/thanh-vien\/ho-so\/[0-9a-f-]{36}$/);
        for (const [i, code] of ["1.1", "1.2"].entries()) {
          await p
            .getByTestId("sheet-criterion")
            .filter({ hasText: code })
            .getByRole("radio", { name: new RegExp(`^${points[i]} điểm`) })
            .check();
        }
        await expect(p.getByTestId("sheet-total")).toHaveText(String(points[0] + points[1]));
        await p.getByRole("button", { name: "Lưu nháp" }).click();
        await expect(p.getByRole("button", { name: "Đã lưu nháp" })).toBeVisible();
        recentlyAuthenticated(who);
        await p.getByRole("button", { name: "Xác nhận phiếu" }).click();
        await p.getByRole("dialog", { name: "Xác nhận phiếu chấm?" }).getByRole("button", { name: "Xác nhận phiếu" }).click();
        await expect(p.getByText(/Phiếu đã xác nhận/).first()).toBeVisible();
      }
    }
  });

  let meetingUrl = "";
  await test.step("The Thư ký lập the Phiên họp with the three hồ sơ and chốt each", async () => {
    await nav(secretaryPage, "Phiên họp, văn bản");
    const form = secretaryPage.getByTestId("create-meeting");
    await form.locator("select[name=roundId]").selectOption({ label: ROUND });
    await form.getByLabel("Tiêu đề").fill("Phiên họp xét công nhận");
    await form.getByLabel("Ngày họp").fill(vnDate(0));
    await form.getByLabel("Địa điểm").fill("Phòng họp Sở NN&MT");
    for (const { product } of PRODUCTS) await form.getByRole("checkbox", { name: new RegExp(product) }).check();
    await form.getByRole("button", { name: "Lập Phiên họp" }).click();
    await secretaryPage.waitForURL(/\/hoi-dong\/van-ban\/[0-9a-f-]{36}$/);
    meetingUrl = new URL(secretaryPage.url()).pathname;
    for (const [d, result] of [
      [FIVE, "5 sao, 100"],
      [FOUR, "4 sao, 75"],
      [ONE, "1 sao, 25"],
    ] as const) {
      await secretaryPage.goto(`/hoi-dong/chot-diem/${idOf(d)}`);
      await secretaryPage.getByTestId("finalize").click();
      await secretaryPage.getByTestId("finalize-word").fill("CHỐT");
      recentlyAuthenticated(secretary);
      await secretaryPage.getByTestId("finalize-confirm").click();
      await expect(secretaryPage.getByTestId("finalized")).toContainText(result);
    }
  });

  // ---------------------------------------------------------------------------------------------------------
  // L16 Kết quả
  // ---------------------------------------------------------------------------------------------------------

  await test.step("CT-13 the Thư ký writes the Nhận xét chung of the hồ sơ 4 sao", async () => {
    await secretaryPage.goto(`/hoi-dong/chot-diem/${idOf(FOUR)}`);
    const section = secretaryPage.getByTestId("general-comment");
    await section.getByLabel("Nhận xét chung").fill(GENERAL_COMMENT);
    await section.getByRole("button", { name: "Lưu nhận xét chung" }).click();
    await expect(section.getByRole("status")).toHaveText("Đã lưu.");
    await secretaryPage.reload();
    await expect(secretaryPage.getByTestId("general-comment").getByLabel("Nhận xét chung")).toHaveValue(GENERAL_COMMENT);
  });

  await test.step("Before Công bố kết quả the Chủ thể sees only that the Hội đồng has chốt điểm", async () => {
    await ownerPage.goto(ownerUrls[FOUR.product]!);
    const result = ownerPage.getByTestId("entity-result");
    await expect(result).toContainText("Đã chốt điểm, chờ quyết định");
    await expect(result).not.toContainText("điểm (");
    await expect(ownerPage.getByText(GENERAL_COMMENT)).toHaveCount(0);
    for (const who of [m1, m2, secretary]) await expect(ownerPage.getByText(who.fullName)).toHaveCount(0);
  });

  await test.step("HD-10, HD-11 the Thư ký uploads the biên bản đã ký and Kết thúc the Phiên họp", async () => {
    await secretaryPage.goto(meetingUrl);
    await secretaryPage.getByLabel(/Tải lên bản đã ký/).setInputFiles(pdf("Bien-ban-hop-da-ky.pdf"));
    await secretaryPage.getByRole("button", { name: "Tải lên", exact: true }).click();
    await expect(secretaryPage.getByTestId("meeting-minutes")).toContainText("Đã ký · bản 1");
    await secretaryPage.getByRole("button", { name: "Kết thúc Phiên họp" }).click();
    await expect(secretaryPage.getByRole("button", { name: "Kết thúc Phiên họp" })).toHaveCount(0);
  });

  await test.step("HD-11 the Sở ghi nhận the Quyết định công nhận of the Phiên họp", async () => {
    await nav(provincePage, "Phiên họp, quyết định");
    const row = provincePage.getByTestId("province-meeting-row").filter({ hasText: COUNCIL });
    await expect(row).toContainText("Chờ ghi nhận");
    await row.getByRole("link", { name: "Phiên họp xét công nhận" }).click();
    await provincePage.waitForURL(/\/so\/phien-hop\/[0-9a-f-]{36}$/);
    const sections = provincePage.getByTestId("decision-dossier");
    await expect(sections.filter({ hasText: FOUR.product })).toContainText("Công nhận 4 sao");
    await expect(sections.filter({ hasText: FIVE.product })).toContainText("Đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao");
    await expect(sections.filter({ hasText: ONE.product })).toContainText("Không đạt, không có trong quyết định");
    const form = provincePage.getByRole("form", { name: "Ghi nhận Quyết định công nhận" });
    await form.getByLabel("Số quyết định").fill(`${stamp % 1000}/QĐ-UBND`);
    await form.getByLabel("Ngày ký").fill(vnDate(0));
    await form.getByLabel(/Bản quyết định đã ký/).setInputFiles(pdf("Quyet-dinh-cong-nhan.pdf"));
    await form.getByRole("button", { name: "Ghi nhận quyết định" }).click();
    await expect(provincePage.getByTestId("recorded-decision")).toContainText(`Số ${stamp % 1000}/QĐ-UBND`);
    // Recording moves the hồ sơ 4 sao to Công nhận; the hồ sơ 5 sao and the hồ sơ 1 sao stay Đã chốt điểm.
    await expect(sections.filter({ hasText: FOUR.product })).toContainText("Công nhận 3/4 sao");
    await expect(sections.filter({ hasText: FIVE.product })).toContainText("Đã chốt điểm");
    await expect(sections.filter({ hasText: ONE.product })).toContainText("Đã chốt điểm");
  });

  await test.step("HD-11 the Sở downloads the bản nháp Giấy chứng nhận (Gotenberg PDF) and tải lên the signed one", async () => {
    await nav(provincePage, "Giấy chứng nhận");
    const row = provincePage.getByTestId("certificate-row").filter({ hasText: FOUR.product });
    await expect(row).toContainText("4 sao");
    await expect(row).toContainText("Chờ ký");
    // The bản nháp is rendered and converted by the worker; the page refreshes while it is being made.
    const draft = row.getByRole("button", { name: "Bản nháp PDF" });
    await expect(draft).toBeVisible({ timeout: 120_000 });
    const file = await download(provincePage, draft, /\.pdf$/);
    expect(
      readFileSync((await file.path())!)
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    await row.getByRole("button", { name: "Tải lên bản đã ký" }).click();
    await row.getByRole("form", { name: "Tải lên giấy chứng nhận đã ký" }).locator("input[type=file]").setInputFiles(pdf("Giay-chung-nhan-da-ky.pdf"));
    await row.getByRole("button", { name: "Lưu" }).click();
    await expect(row).toContainText("Đã ký");
    await expect(row.getByRole("button", { name: "Bản đã ký (lần 1)" })).toBeVisible();
  });

  await test.step("HD-10 the Sở phát hành the Thư kết quả không đạt of the hồ sơ 1 sao", async () => {
    await provincePage.goto(`/so/ho-so/${idOf(ONE)}`);
    await expect(provincePage.getByTestId("province-result")).toContainText("1 sao (không đạt)");
    await provincePage.getByRole("link", { name: "Soạn Thư kết quả không đạt" }).click();
    await provincePage.waitForURL(`/so/ho-so/${idOf(ONE)}/thu-ket-qua`);
    const form = provincePage.getByRole("form", { name: "Soạn Thư kết quả không đạt" });
    await form.getByLabel("Lời khuyên cải thiện").fill(ADVICE);
    await download(provincePage, form.getByRole("button", { name: "Xem trước (Word)" }), /\.docx$/);
    await form.getByRole("button", { name: "Phát hành thư" }).click();
    const issued = provincePage.getByTestId("issued-letters");
    await expect(issued).toContainText("Thư kết quả");
    await download(provincePage, issued.getByRole("button", { name: "Tải PDF" }), /\.pdf$/);
  });

  await test.step("CT-13 the Chủ thể sees each kết quả, the Nhận xét chung and the thư, never a thành viên", async () => {
    await ownerPage.goto(ownerUrls[FOUR.product]!);
    let result = ownerPage.getByTestId("entity-result");
    await expect(result).toContainText("Công nhận 4 sao");
    await expect(result).toContainText("75 điểm");
    await expect(result).toContainText(GENERAL_COMMENT);

    await ownerPage.goto(ownerUrls[FIVE.product]!);
    result = ownerPage.getByTestId("entity-result");
    await expect(result).toContainText("Đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao");

    await ownerPage.goto(ownerUrls[ONE.product]!);
    result = ownerPage.getByTestId("entity-result");
    await expect(result).toContainText("Không đạt");
    const letter = result.getByTestId("result-letter");
    await expect(letter).toContainText(ADVICE);
    const letterPdf = await download(ownerPage, letter.getByRole("button", { name: "Tải Thư kết quả (PDF)" }), /\.pdf$/);
    expect(
      readFileSync((await letterPdf.path())!)
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");

    for (const d of PRODUCTS) {
      await ownerPage.goto(ownerUrls[d.product]!);
      await expect(ownerPage.getByTestId("entity-result")).toBeVisible();
      for (const who of [m1, m2, chair, secretary]) await expect(ownerPage.getByText(who.fullName)).toHaveCount(0);
      await expect(ownerPage.getByText("Phiếu chấm")).toHaveCount(0);
    }
  });

  // ---------------------------------------------------------------------------------------------------------
  // L17 Đề xuất 5 sao
  // ---------------------------------------------------------------------------------------------------------

  const fiveRow = () => provincePage.getByTestId("five-star-row").filter({ hasText: FIVE.product });
  await test.step("SO-04 the Sở xuất the Gói đề nghị 5 sao and downloads it once ready", async () => {
    await nav(provincePage, "Hồ sơ 5 sao");
    await expect(fiveRow()).toContainText("5 sao · 100 điểm");
    await fiveRow().getByRole("checkbox").check();
    await provincePage.getByRole("button", { name: "Xuất gói đề nghị 5 sao" }).click();
    await expect(provincePage.getByRole("status").filter({ hasText: "Đang tạo gói" })).toBeVisible();
    const packageRow = provincePage.getByTestId("five-star-package-row").first();
    await expect(async () => {
      await provincePage.reload();
      await expect(packageRow).toContainText("Sẵn sàng", { timeout: 2_000 });
    }).toPass({ timeout: 180_000 });
    const zip = await download(provincePage, packageRow.getByRole("link", { name: /Tải gói/ }), /\.zip$/);
    const listing = execFileSync("unzip", ["-l", (await zip.path())!], { encoding: "utf8" });
    // The Mục lục is converted to PDF by Gotenberg; the hồ sơ folder carries its Bảng điểm.
    for (const entry of ["De nghi UBND tinh.docx", "Muc luc.pdf", "05 Bang diem.xlsx"]) expect(listing).toContain(entry);
  });

  await test.step("SO-04 the Sở đánh dấu đã gửi, then the Bộ chuyển về công nhận cấp tỉnh", async () => {
    await fiveRow().getByRole("button", { name: "Đánh dấu đã gửi" }).click();
    const sent = fiveRow().getByRole("form", { name: /Đánh dấu đã gửi/ });
    await sent.getByLabel("Số công văn").fill(`${stamp % 1000}/SNNMT-PTNT`);
    await sent.getByLabel("Ngày gửi").fill(vnDate(0));
    await sent.getByRole("button", { name: "Lưu" }).click();
    await expect(fiveRow()).toContainText(`Công văn ${stamp % 1000}/SNNMT-PTNT`);

    await ownerPage.goto(ownerUrls[FIVE.product]!);
    await expect(ownerPage.getByTestId("entity-result")).toContainText("Tỉnh đã gửi đề nghị Trung ương đánh giá 5 sao");

    await fiveRow().getByRole("button", { name: "Chuyển về công nhận cấp tỉnh" }).click();
    const back = fiveRow().getByRole("form", { name: /Chuyển về công nhận cấp tỉnh/ });
    await back.getByLabel(/Văn bản của Bộ/).setInputFiles(pdf("Van-ban-Bo-chuyen-ve.pdf"));
    await back.getByRole("button", { name: "Chuyển về" }).click();
    await expect(fiveRow()).toContainText("Chờ Quyết định công nhận bổ sung");
  });

  await test.step("The Sở ghi nhận the Quyết định công nhận bổ sung; the Chủ thể sees 4 sao", async () => {
    await provincePage.getByRole("link", { name: "Quyết định công nhận bổ sung →" }).click();
    await provincePage.waitForURL("/so/ho-so-5-sao/quyet-dinh-bo-sung");
    const form = provincePage.getByRole("form", { name: "Ghi nhận Quyết định công nhận bổ sung" });
    await expect(form.getByTestId("supplementary-candidate").filter({ hasText: FIVE.product })).toBeVisible();
    await download(provincePage, form.getByRole("link", { name: /Tải dự thảo quyết định/ }), /\.docx$/);
    await form.getByLabel("Số quyết định").fill(`${stamp % 1000}/QĐ-UBND-BS`);
    await form.getByLabel("Ngày ký").fill(vnDate(0));
    await form.getByLabel(/Bản quyết định đã ký/).setInputFiles(pdf("Quyet-dinh-bo-sung.pdf"));
    await form.getByRole("button", { name: "Ghi nhận quyết định bổ sung" }).click();
    await expect(provincePage.getByTestId("supplementary-decision").filter({ hasText: `Số ${stamp % 1000}/QĐ-UBND-BS` })).toContainText(FIVE.product);

    await ownerPage.goto(ownerUrls[FIVE.product]!);
    const result = ownerPage.getByTestId("entity-result");
    await expect(result).toContainText("Công nhận 4 sao");
    await expect(result).toContainText("tỉnh công nhận 4 sao theo Quyết định công nhận bổ sung");
  });

  // ---------------------------------------------------------------------------------------------------------
  // L22 Xuất Excel, mẫu văn bản
  // ---------------------------------------------------------------------------------------------------------

  await test.step("DC-05 the Sở xuất Excel the danh sách hồ sơ and the danh sách sản phẩm đạt sao", async () => {
    await nav(provincePage, "Hồ sơ toàn tỉnh");
    const list = await download(provincePage, provincePage.getByTestId("export-excel"), /\.xlsx$/);
    const listText = await xlsxText(list);
    for (const { product } of PRODUCTS) expect(listText).toContain(product);
    await nav(provincePage, "Giấy chứng nhận");
    const starForm = provincePage.getByRole("form", { name: "Xuất danh sách sản phẩm đạt sao" });
    const stars = await download(provincePage, starForm.getByRole("button", { name: "Xuất Excel" }), /\.xlsx$/);
    const starsText = await xlsxText(stars);
    expect(starsText).toContain(FOUR.product);
    expect(starsText).toContain(FIVE.product);
    expect(starsText).not.toContain(ONE.product);
    // Both Giấy chứng nhận 4 sao are there: the Phiên họp's and the bổ sung one.
    await expect(provincePage.getByTestId("certificate-row").filter({ hasText: FIVE.product })).toContainText("4 sao");
  });

  await test.step("The Quản trị tải mẫu Thư kết quả không đạt về and tải lên lại as a new phiên bản", async () => {
    await nav(adminPage, "Mẫu văn bản");
    await adminPage.getByRole("link", { name: "Thư kết quả không đạt" }).click();
    await adminPage.waitForURL("/quan-tri/mau-van-ban/result_letter");
    const defaultRow = adminPage.getByRole("row").filter({ hasText: "Mẫu mặc định" });
    const template = await download(adminPage, defaultRow.getByRole("link", { name: "Tải về" }), /\.docx$/);
    await adminPage.getByLabel("Tệp mẫu đã hiệu chỉnh").setInputFiles({
      name: "Thu ket qua khong dat (sua).docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: readFileSync((await template.path())!),
    });
    await adminPage.getByRole("button", { name: "Tải lên" }).click();
    // Phiên bản 1 on a fresh stack; a re-run on the same stack adds the next one.
    const saved = adminPage.getByRole("status").filter({ hasText: /Đã lưu phiên bản \d+, là mẫu đang dùng\./ });
    await expect(saved).toBeVisible({ timeout: 90_000 });
    const n = /phiên bản (\d+)/.exec((await saved.textContent())!)![1];
    await expect(adminPage.getByRole("row").filter({ hasText: `Phiên bản ${n}` })).toContainText("Đang dùng");
  });

  await test.step("Each kết quả action left its audit row and outbox event", async () => {
    const actions = sql(
      `SELECT DISTINCT action FROM platform.audit_log WHERE target_id IN ('${idOf(FIVE)}', '${idOf(FOUR)}', '${idOf(ONE)}') OR metadata->>'dossierId' IN ('${idOf(FIVE)}', '${idOf(FOUR)}', '${idOf(ONE)}')`,
    ).map(([a]) => a);
    expect(actions).toEqual(
      expect.arrayContaining([
        "dossier.general_comment.edit",
        "dossier.recognize",
        "dossier.result_publish",
        "dossier.result_letter.issue",
        "dossier.five_star.mark_sent",
        "dossier.five_star.return_to_province",
        "dossier.recognize_supplementary",
      ]),
    );
    const events = sql(`SELECT DISTINCT type FROM platform.outbox WHERE payload->>'dossierId' IN ('${idOf(FIVE)}', '${idOf(FOUR)}', '${idOf(ONE)}')`).map(
      ([t]) => t,
    );
    expect(events).toEqual(expect.arrayContaining(["dossier.result_published", "certificate.issued", "certificate.signed", "result_letter.issued"]));
  });
});

/** Creates an officer from the Quản trị's user page and grants one Vai trò, with its Phạm vi (the option text) when it has one. */
async function createStaff(page: Page, who: Person, role: string, scope?: string | RegExp) {
  await nav(page, "Người dùng và phân vai");
  await page.getByLabel("Họ tên").fill(who.fullName);
  await page.getByLabel("Email").fill(who.email);
  await page.getByRole("button", { name: "Thêm cán bộ" }).click();
  await expect(page.getByRole("status")).toContainText(who.email);
  await page.getByRole("link", { name: who.fullName }).click();
  await page.getByLabel("Vai trò").selectOption({ label: role });
  if (scope) {
    const select = page.locator("select[name=scopeId]");
    const value = await select.locator("option").filter({ hasText: scope }).first().getAttribute("value");
    await select.selectOption(value!);
  }
  await page.getByRole("button", { name: "Gán vai trò" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã gán vai trò");
}
