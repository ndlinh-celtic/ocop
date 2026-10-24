import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { activateFromEmail, enrolTotp, freshCode, pdf, signInAsAdmin, sql, vnDate } from "./support";

/**
 * Spec #49 step 4 (#64): L08 to L15 through the real stack, one role per browser, in both Chế độ chấm, from a hồ
 * sơ Đã chuyển tỉnh to Đã chốt điểm. The rules themselves are covered by the use-case and permission-matrix tests
 * in packages/infra/test/{councils,scoring}; this proves the pages carry them.
 *
 * Only one đợt takes nộp at a time, and a đợt's Chế độ chấm is fixed at its first Giao chấm, so the two modes need
 * two đợt: the first one's Hạn nộp xã is moved into the past by SQL once its hồ sơ is nộp, which lets the second open.
 */

const stamp = Date.now();
/** From packages/infra/seed/wards.sample.csv, seeded by the global setup. */
const WARD = { name: "Xã Mẫu Đồng Xanh", code: "90003" };
const LEGAL_BASIS = `E2E HĐ ${stamp}/2026/QĐ-TTg`;
const SET_NAME = "Đồ uống E2E";
const PASSWORD = "mat-khau-e2e-12345";
const ADVISORY_PRODUCT = `Trà mãng cầu E2E ${stamp}`;
const DIRECT_PRODUCT = `Nước cốt dừa E2E ${stamp}`;

interface Person {
  email: string;
  fullName: string;
}
const person = (slug: string, fullName: string): Person => ({ email: `${slug}.${stamp}@ocop.local`, fullName: `${fullName} ${stamp}` });
const owner = { ...person("hd.chu.the", "Hợp tác xã Đồng Xanh"), identifier: String(stamp + 7).padStart(12, "0").slice(-12) };
const wardOfficer = person("hd.can.bo.xa", "Cán bộ Đồng Xanh");
const provinceOfficer = person("hd.can.bo.so", "Cán bộ Sở HĐ");
const chair = person("hd.chu.tich", "Chủ tịch HĐ");
const secretary = person("hd.thu.ky", "Thư ký HĐ");
const members = [person("hd.tv1", "Thành viên Một"), person("hd.tv2", "Thành viên Hai"), person("hd.tv3", "Thành viên Ba"), person("hd.tv4", "Thành viên Bốn")];
const [m1, m2, m3, m4] = members as [Person, Person, Person, Person];
const leader = person("hd.to.truong", "Tổ trưởng TTV");
const COUNCIL = `Hội đồng OCOP E2E ${stamp}`;

/** A one-set Phiên bản tiêu chí in the QĐ 26 extraction format: two Tiêu chí of 50 points in Phần A. */
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
    ngay_ban_hanh: "2026-01-03",
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
  // window.confirm guards Giao chấm, mở đợt and similar one-click actions.
  page.on("dialog", (d) => void d.accept());
  return page;
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name, exact: true }).click();
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
/** Lists of hồ sơ link each row by its Mã hồ sơ; this opens the row of a product. */
const openRow = (page: Page, product: string) => page.getByRole("row").filter({ hasText: product }).getByRole("link").first().click();

/** TOTP secrets by email, for Xác thực lại. */
const secrets = new Map<string, string>();

/** Activates an officer from the email and enrols TOTP (mandatory for every council Vai trò). */
async function activateStaff(browser: Browser, who: Person) {
  const page = await newPage(browser);
  await activateFromEmail(page, who.email, PASSWORD);
  secrets.set(who.email, await enrolTotp(page));
  await page.waitForURL("/");
  return page;
}

/**
 * Xác thực lại (ADR 0003): moves the sign-in of `who` more than 5 minutes back, as if the journey had taken that
 * long, clicks `trigger`, answers the dialog with a fresh TOTP code and waits for `done`.
 */
async function withReauth(page: Page, who: Person, trigger: Locator, done: Locator) {
  sql(`UPDATE identity.session SET authenticated_at = now() - interval '6 minutes' WHERE revoked_at IS NULL AND user_id = (SELECT id FROM identity.user_account WHERE email = '${who.email}')`);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Xác thực lại" });
  await dialog.getByLabel("Mã xác thực").fill(await freshCode(secrets.get(who.email)!));
  await dialog.getByRole("button", { name: "Xác nhận" }).click();
  await expect(done).toBeVisible();
}

/** Moves the Hạn nộp xã of every đợt Đang nhận nộp into the past, so the next Mở đợt closes it (instead of waiting days). */
function expireOpenRounds() {
  sql("UPDATE round.round SET submission_deadline = now() - interval '1 day' WHERE status = 'open_for_submission'");
}

test("L08–L15 the Sở tiếp nhận, the Hội đồng grades in both Chế độ chấm and chốt điểm", async ({ page: adminPage, browser }) => {
  test.setTimeout(1_800_000);

  await test.step("Quản trị publishes a Phiên bản tiêu chí and creates the Sở and xã officers", async () => {
    await signInAsAdmin(adminPage);
    await nav(adminPage, "Bộ tiêu chí");
    await adminPage.getByLabel(/Tệp JSON/).setInputFiles({ name: "tieu-chi-hd-e2e.json", mimeType: "application/json", buffer: Buffer.from(criteriaJson()) });
    await adminPage.getByRole("button", { name: "Nhập thành bản nháp" }).click();
    await adminPage.getByRole("status").getByRole("link", { name: "Mở bản nháp" }).click();
    await adminPage.getByRole("button", { name: "Phát hành" }).click();
    await adminPage.getByRole("dialog", { name: "Phát hành phiên bản tiêu chí?" }).getByRole("button", { name: "Phát hành" }).click();
    await expect(adminPage.getByText("Đã phát hành").first()).toBeVisible();
    await createStaff(adminPage, wardOfficer, "Cán bộ xã", `${WARD.name} (${WARD.code})`);
    await createStaff(adminPage, provinceOfficer, "Cán bộ Sở");
  });

  const provincePage = await activateStaff(browser, provinceOfficer);
  await test.step("HD-01 the Cán bộ Sở records the Hội đồng from its quyết định thành lập", async () => {
    await nav(provincePage, "Hội đồng");
    await provincePage.getByLabel("Tên hội đồng").fill(COUNCIL);
    await provincePage.getByLabel("Số quyết định thành lập").fill(`${stamp % 1000}/QĐ-UBND`);
    await provincePage.getByLabel("Ngày quyết định").fill(vnDate(-30));
    await provincePage.getByLabel("Tệp quyết định").setInputFiles(pdf("Quyet-dinh-thanh-lap-hoi-dong.pdf"));
    await provincePage.getByRole("button", { name: "Ghi nhận hội đồng" }).click();
    await provincePage.waitForURL(/\/so\/hoi-dong\/[0-9a-f-]{36}$/);
    await expect(heading(provincePage)).toHaveText(COUNCIL);
  });
  const councilUrl = new URL(provincePage.url()).pathname;

  await test.step("HD-01 Quản trị grants the Phân vai on the Hội đồng", async () => {
    const council = new RegExp(`^${COUNCIL}`);
    await createStaff(adminPage, chair, "Chủ tịch hội đồng", council);
    await createStaff(adminPage, secretary, "Thư ký hội đồng", council);
    for (const m of members) await createStaff(adminPage, m, "Thành viên hội đồng", council);
    await createStaff(adminPage, leader, "Thành viên Tổ tư vấn", council);
  });

  const pages = new Map<string, Page>();
  await test.step("Every Phân vai holder activates and enrols TOTP", async () => {
    for (const who of [chair, secretary, ...members, leader]) pages.set(who.email, await activateStaff(browser, who));
  });
  const pageOf = (who: Person) => pages.get(who.email)!;
  const secretaryPage = pageOf(secretary);
  const leaderPage = pageOf(leader);

  await test.step("HD-01 the Cán bộ Sở sees the members by Vai trò and names the Tổ trưởng", async () => {
    await provincePage.goto(councilUrl);
    for (const who of [chair, secretary, ...members, leader]) await expect(provincePage.getByRole("cell", { name: who.fullName })).toBeVisible();
    await provincePage.getByLabel("Tổ trưởng Tổ tư vấn").selectOption({ label: leader.fullName });
    await provincePage.getByRole("button", { name: "Chỉ định Tổ trưởng" }).click();
    await expect(provincePage.getByRole("status")).toHaveText("Đã lưu");
  });

  /** SO-01: creates and opens a đợt on the version, with its Chế độ chấm and 2 người chấm tối thiểu, and gán the Hội đồng. */
  async function openRound(name: string, mode: "Chấm trực tiếp" | "Dựa trên Tổ tư vấn") {
    await nav(provincePage, "Đợt đánh giá");
    await provincePage.getByRole("link", { name: /Tạo đợt/ }).click();
    await provincePage.getByLabel("Tên đợt").fill(name);
    await provincePage.getByLabel("Hạn nộp xã").fill(vnDate(20));
    await provincePage.getByLabel("Hạn gửi tỉnh").fill(vnDate(40));
    await provincePage.getByLabel("Hạn đánh giá tỉnh").fill(vnDate(60));
    await provincePage.getByLabel("Phiên bản tiêu chí").selectOption({ label: `${LEGAL_BASIS} (ban hành 03/01/2026)` });
    await provincePage.getByRole("radio", { name: new RegExp(mode) }).check();
    await provincePage.getByLabel("Số người chấm tối thiểu").fill("2");
    await provincePage.getByRole("button", { name: "Tạo đợt (Nháp)" }).click();
    await provincePage.getByRole("button", { name: "Mở đợt" }).click();
    await expect(provincePage.getByText("Đang nhận nộp").first()).toBeVisible();
    await provincePage.locator("select[name=councilId]").selectOption({ label: COUNCIL });
    await provincePage.getByRole("button", { name: "Gán hội đồng" }).click();
    await expect(provincePage.getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
  }

  const ownerPage = await newPage(browser);
  await test.step("A Chủ thể registers, activates and adds its giấy tờ pháp lý", async () => {
    await ownerPage.goto("/dang-ky");
    await ownerPage.getByText("Hộ sản xuất", { exact: true }).click();
    await ownerPage.getByLabel("Họ tên chủ hộ").fill(owner.fullName);
    await ownerPage.getByLabel("Số định danh cá nhân của chủ hộ").fill(owner.identifier);
    await ownerPage.getByLabel("Xã/phường").selectOption({ label: WARD.name });
    await ownerPage.getByLabel("Địa chỉ").fill(`Ấp 2, ${WARD.name}`);
    await ownerPage.getByLabel("Người đại diện").fill(owner.fullName);
    await ownerPage.getByLabel("Số điện thoại").fill("0907654321");
    await ownerPage.getByLabel("Email").fill(owner.email);
    await ownerPage.getByLabel(/Tôi đồng ý/).check();
    await ownerPage.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(ownerPage.getByRole("heading", { name: "Kiểm tra hộp thư của bạn" })).toBeVisible();
    await activateFromEmail(ownerPage, owner.email, PASSWORD);
    await ownerPage.waitForURL("/");
    await nav(ownerPage, "Hồ sơ pháp lý");
    await ownerPage.getByLabel("Loại giấy tờ").selectOption({ label: "Giấy chứng nhận đăng ký doanh nghiệp, hợp tác xã hoặc hộ kinh doanh" });
    await ownerPage.getByLabel("Số giấy tờ").fill("HKD-HD-01");
    await ownerPage.getByLabel("Ngày cấp").fill("2025-03-15");
    await ownerPage.getByLabel("Tệp giấy tờ").setInputFiles(pdf("Giay-dang-ky-hop-tac-xa.pdf"));
    await ownerPage.getByRole("button", { name: "Thêm giấy tờ" }).click();
    await expect(ownerPage.getByTestId("verified")).toBeVisible({ timeout: 90_000 });
  });

  /** CT-03 to CT-09: a hồ sơ on the Bộ tiêu chí with its minh chứng and tự chấm, nộp to the xã; returns its Chủ thể URL. */
  async function submitDossier(product: string) {
    await nav(ownerPage, "Hồ sơ của tôi");
    await ownerPage.getByRole("link", { name: "Tạo hồ sơ" }).click();
    await ownerPage.getByRole("radio", { name: new RegExp(SET_NAME) }).check();
    await ownerPage.getByLabel("Tôi đã hiểu").check();
    await ownerPage.getByRole("button", { name: "Tạo hồ sơ" }).click();
    await ownerPage.waitForURL(/\/chu-the\/ho-so\/[0-9a-f-]{36}$/);
    const url = new URL(ownerPage.url()).pathname;
    await ownerPage.getByLabel("Tên sản phẩm").fill(product);
    await ownerPage.getByLabel("Mô tả sản phẩm").fill(`${product} của hợp tác xã`);
    await ownerPage.getByLabel("Nguyên liệu").fill("Nguyên liệu tại địa phương");
    await ownerPage.getByLabel("Quy trình sản xuất").fill("Sơ chế, chế biến, đóng chai");
    await ownerPage.getByLabel("Bao bì, nhãn mác").fill("Chai thủy tinh 500 ml");
    await ownerPage.getByLabel("Công bố chất lượng").fill("Tự công bố số 02/2026");
    await ownerPage.getByLabel("Công bố chất lượng").blur();
    await expect(ownerPage.getByTestId("autosave-status")).toHaveText("Đã lưu tự động.");
    await ownerPage.getByLabel("Tệp minh chứng").setInputFiles(pdf("Hop-dong-nguyen-lieu.pdf"));
    await ownerPage.getByRole("button", { name: "Tải lên" }).click();
    await expect(ownerPage.getByText("Đã quét sạch")).toBeVisible({ timeout: 90_000 });
    await ownerPage.getByText("Gắn với tiêu chí").click();
    await ownerPage.getByRole("checkbox", { name: /1\.1 Nguồn nguyên liệu/ }).check();
    await ownerPage.getByRole("checkbox", { name: /1\.2 Liên kết sản xuất/ }).check();
    await ownerPage.getByRole("button", { name: "Lưu gắn tiêu chí" }).click();
    await expect(ownerPage.getByText(/Gắn với tiêu chí 1\.1/)).toBeVisible();
    const levels = ownerPage.getByLabel("Mức điểm tự chấm");
    await levels.nth(0).selectOption({ label: "Đạt đầy đủ · 50 điểm" });
    await expect(levels.nth(0)).toBeEnabled();
    await levels.nth(1).selectOption({ label: "Đạt đầy đủ · 50 điểm" });
    await expect(ownerPage.getByLabel("Ước lượng hạng sao")).toContainText("Tổng điểm: 100");
    await ownerPage.getByRole("button", { name: "Nộp hồ sơ" }).click();
    await expect(heading(ownerPage)).toContainText("Đã nộp xã");
    return url;
  }

  let advisoryOwnerUrl = "";
  let directOwnerUrl = "";
  await test.step("SO-01 the Sở opens a đợt Dựa trên Tổ tư vấn and the Chủ thể nộp a hồ sơ into it", async () => {
    // A đợt left Đang nhận nộp by an earlier journey would block Mở đợt.
    expireOpenRounds();
    await openRound(`Đợt TTV E2E ${stamp}`, "Dựa trên Tổ tư vấn");
    advisoryOwnerUrl = await submitDossier(ADVISORY_PRODUCT);
  });

  await test.step("SO-01 the Sở opens a đợt Chấm trực tiếp once the first closes, and the Chủ thể nộp a second hồ sơ", async () => {
    expireOpenRounds();
    await openRound(`Đợt trực tiếp E2E ${stamp}`, "Chấm trực tiếp");
    directOwnerUrl = await submitDossier(DIRECT_PRODUCT);
  });

  const wardPage = await newPage(browser);
  await test.step("XA-02 to XA-07 the Cán bộ xã Tiếp nhận both hồ sơ, assesses them and gửi tỉnh", async () => {
    await activateFromEmail(wardPage, wardOfficer.email, PASSWORD);
    await wardPage.waitForURL("/");
    for (const product of [ADVISORY_PRODUCT, DIRECT_PRODUCT]) {
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

  const dossierIds: Record<string, string> = {};
  await test.step("SO-02 the Cán bộ Sở Tiếp nhận tại tỉnh both hồ sơ", async () => {
    for (const product of [ADVISORY_PRODUCT, DIRECT_PRODUCT]) {
      await nav(provincePage, "Hồ sơ toàn tỉnh");
      await provincePage.getByRole("link", { name: /Chờ tiếp nhận/ }).click();
      await provincePage.getByRole("link", { name: product }).click();
      await provincePage.waitForURL(/\/so\/ho-so\/[0-9a-f-]{36}$/);
      dossierIds[product] = new URL(provincePage.url()).pathname.split("/").at(-1)!;
      await provincePage.getByRole("button", { name: "Tiếp nhận tại tỉnh" }).click();
      await expect(provincePage.getByText(/Đã tiếp nhận tại tỉnh lúc/)).toBeVisible();
      await expect(provincePage.getByTestId("flash")).toContainText("Đã tiếp nhận hồ sơ tại tỉnh.");
    }
  });
  const advisoryId = dossierIds[ADVISORY_PRODUCT]!;
  const directId = dossierIds[DIRECT_PRODUCT]!;

  /** HD-02, HD-06: the Thư ký saves a Phân công nháp on one hồ sơ, then Giao chấm it. */
  async function assignAndStart(product: string, graders: Person[], advisors: Person[]) {
    await nav(secretaryPage, "Phân công");
    const row = secretaryPage.getByTestId("assignment-row").filter({ hasText: product });
    await row.getByRole("checkbox").check();
    const memberPicker = secretaryPage.getByRole("group", { name: /^Thành viên chấm/ });
    for (const g of graders) await memberPicker.getByLabel(g.fullName).check();
    const advisoryPicker = secretaryPage.getByRole("group", { name: /^Thành viên Tổ tư vấn/ });
    for (const a of advisors) await advisoryPicker.getByLabel(a.fullName).check();
    await secretaryPage.getByRole("button", { name: "Lưu Phân công nháp" }).click();
    await expect(secretaryPage.getByText("Đã lưu Phân công nháp cho 1 hồ sơ.")).toBeVisible();
    await expect(row.getByText("Nháp").first()).toBeVisible();
    await secretaryPage.getByRole("button", { name: "Giao chấm" }).click();
    // The hồ sơ leaves the board (the board goes too when it was the last one) for the Giao chấm list; the message stays.
    await expect(secretaryPage.getByTestId("graded-row").filter({ hasText: product })).toBeVisible();
    await expect(secretaryPage.getByTestId("flash")).toContainText("Đã Giao chấm 1 hồ sơ.");
    await expect(row).toHaveCount(0);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Chế độ dựa trên Tổ tư vấn
  // ---------------------------------------------------------------------------------------------------------

  await test.step("HD-02, HD-06 the Thư ký Phân công two thành viên chấm and the Tổ trưởng, then Giao chấm", async () => {
    await nav(secretaryPage, "Phân công");
    await expect(secretaryPage.getByTestId("grading-mode").filter({ hasText: `Đợt TTV E2E ${stamp}` })).toBeVisible();
    await assignAndStart(ADVISORY_PRODUCT, [m1, m2], [leader]);
    // The Chế độ chấm of the đợt is now fixed.
    await expect(secretaryPage.getByTestId("grading-mode").filter({ hasText: `Đợt TTV E2E ${stamp}` })).toContainText("không đổi được nữa");
  });

  await test.step("TM-01, TM-02 the Tổ trưởng finds it in the Hàng đợi thẩm định and saves the nháp chung", async () => {
    await nav(leaderPage, "Hàng đợi thẩm định");
    await openRow(leaderPage, ADVISORY_PRODUCT);
    await leaderPage.waitForURL(`/to-tu-van/ho-so/${advisoryId}`);
    await expect(heading(leaderPage)).toContainText("Tổ tư vấn thẩm định");
    await leaderPage.getByLabel("Điểm đề xuất 1.1").selectOption({ label: "50 điểm · Đạt đầy đủ" });
    await leaderPage.getByLabel("Căn cứ 1.1").fill("Hợp đồng nguyên liệu đầy đủ");
    await leaderPage.getByLabel("Điểm đề xuất 1.2").selectOption({ label: "25 điểm · Đạt một phần" });
    await leaderPage.getByLabel("Căn cứ 1.2").fill("Liên kết mới với một hộ");
    await expect(leaderPage.getByTestId("advisory-sums")).toContainText("Tổng 75");
    await leaderPage.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(leaderPage.getByText("Đã lưu nháp.")).toBeVisible();
  });

  await test.step("TM-07 the Tổ trưởng phát hành phiên bản 1 of the Báo cáo Tổ tư vấn", async () => {
    await leaderPage.getByRole("link", { name: /Soạn và phát hành báo cáo/ }).click();
    await leaderPage.waitForURL(`/to-tu-van/ho-so/${advisoryId}/bao-cao`);
    await leaderPage.getByRole("button", { name: "Phát hành báo cáo Tổ tư vấn" }).click();
    await leaderPage.getByRole("dialog").getByRole("button", { name: "Phát hành" }).click();
    await expect(heading(leaderPage)).toContainText("Đã phát hành báo cáo Tổ tư vấn");
  });

  await test.step("TM-08, TM-09 the Tổ tư vấn sao chép the phiên bản into the Phiếu chấm of both thành viên", async () => {
    await nav(leaderPage, "Sao chép sang phiếu chấm");
    await leaderPage.getByRole("checkbox", { name: /Chọn hồ sơ HS-/ }).check();
    await leaderPage.getByRole("button", { name: "Tiếp tục" }).click();
    await leaderPage.getByRole("button", { name: "Xem trước" }).click();
    await expect(leaderPage.getByTestId("copy-summary")).toContainText("2 phiếu mới, 0 phiếu cập nhật, 0 phiếu bỏ qua");
    await leaderPage.getByRole("button", { name: "Xác nhận sao chép" }).click();
    await expect(leaderPage.getByRole("status").filter({ hasText: "Đã sao chép 4 Tiêu chí" })).toBeVisible();
  });

  /** S61: the thành viên's own Phiếu chấm, reached from the Hồ sơ được phân công list. */
  async function openSheet(who: Person, product: string) {
    const p = pageOf(who);
    await nav(p, "Hồ sơ được phân công");
    await openRow(p, product);
    await p.waitForURL(/\/thanh-vien\/ho-so\/[0-9a-f-]{36}$/);
    return p;
  }
  const levelOf = (p: Page, code: string, points: number) =>
    p.getByTestId("sheet-criterion").filter({ hasText: code }).getByRole("radio", { name: new RegExp(`^${points} điểm`) });

  /** TV-07: Xác nhận phiếu, with Xác thực lại when due; the phiếu then shows as locked. */
  async function confirmSheet(who: Person, p: Page) {
    await p.getByRole("button", { name: "Xác nhận phiếu" }).click();
    const dialog = p.getByRole("dialog", { name: "Xác nhận phiếu chấm?" });
    await withReauth(p, who, dialog.getByRole("button", { name: "Xác nhận phiếu" }), p.getByText(/Phiếu đã xác nhận/).first());
  }

  await test.step("TV-04, TV-07 the first thành viên adjusts one Tiêu chí with a lý do and xác nhận", async () => {
    const p = await openSheet(m1, ADVISORY_PRODUCT);
    await expect(p.getByTestId("badge-advisory")).toHaveCount(2);
    await expect(p.getByTestId("advisory-total")).toContainText("75");
    await expect(p.getByTestId("sheet-total")).toHaveText("75");
    await levelOf(p, "1.2", 50).check();
    await expect(p.getByTestId("badge-adjusted")).toBeVisible();
    // Without a lý do the phiếu cannot be confirmed (TV-04).
    await expect(p.getByRole("button", { name: "Xác nhận phiếu" })).toBeDisabled();
    await p.getByLabel(/Lý do điều chỉnh/).fill("Đã kiểm tra thực địa: liên kết với ba hộ");
    await expect(p.getByTestId("sheet-total")).toHaveText("100");
    await confirmSheet(m1, p);
  });

  await test.step("TV-07 the second thành viên keeps the Điểm đề xuất and xác nhận: the hồ sơ is Sẵn sàng chốt", async () => {
    const p = await openSheet(m2, ADVISORY_PRODUCT);
    await expect(p.getByTestId("sheet-total")).toHaveText("75");
    await confirmSheet(m2, p);
    await expect(heading(p)).toContainText("Thành viên xác nhận");
  });

  /** HD-09: the Thư ký lập a Phiên họp in the đợt with the hồ sơ Sẵn sàng chốt. */
  async function createMeeting(roundName: string, product: string, title: string) {
    await nav(secretaryPage, "Phiên họp, văn bản");
    const form = secretaryPage.getByTestId("create-meeting");
    await form.locator("select[name=roundId]").selectOption({ label: roundName });
    await form.getByLabel("Tiêu đề").fill(title);
    await form.getByLabel("Ngày họp").fill(vnDate(0));
    await form.getByLabel("Địa điểm").fill("Phòng họp Sở NN&MT");
    await form.getByRole("checkbox", { name: new RegExp(product) }).check();
    await form.getByRole("button", { name: "Lập Phiên họp" }).click();
    await secretaryPage.waitForURL(/\/hoi-dong\/van-ban\/[0-9a-f-]{36}$/);
    await expect(secretaryPage.getByText(product).first()).toBeVisible();
    return new URL(secretaryPage.url()).pathname;
  }

  /** HD-08: chốt điểm on S43, typing CHỐT and Xác thực lại when due. */
  async function finalize(who: Person, dossierId: string) {
    const p = pageOf(who);
    await p.goto(`/hoi-dong/chot-diem/${dossierId}`);
    await p.getByTestId("finalize").click();
    await p.getByTestId("finalize-word").fill("CHỐT");
    await withReauth(p, who, p.getByTestId("finalize-confirm"), p.getByTestId("finalized"));
    await expect(heading(p)).toContainText("Đã chốt điểm");
    return p;
  }

  await test.step("HD-04, HD-09, HD-08 the Thư ký sees both phiếu, lập the Phiên họp and chốt điểm", async () => {
    await nav(secretaryPage, "Chốt điểm");
    await openRow(secretaryPage, ADVISORY_PRODUCT);
    const table = secretaryPage.getByTestId("aggregate-table");
    await expect(table.getByRole("columnheader", { name: m1.fullName })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: m2.fullName })).toBeVisible();
    await expect(secretaryPage.getByTestId("finalize")).toBeDisabled();
    await createMeeting(`Đợt TTV E2E ${stamp}`, ADVISORY_PRODUCT, "Phiên họp Tổ tư vấn");
    await finalize(secretary, advisoryId);
    await expect(secretaryPage.getByTestId("finalized")).toContainText("4 sao, 87,5");
  });

  await test.step("TM-12 after chốt the Tổ tư vấn sees the kết quả only", async () => {
    await leaderPage.goto(`/to-tu-van/ho-so/${advisoryId}`);
    await expect(leaderPage.getByTestId("advisory-final-result")).toContainText("4 sao, 87,5 điểm");
    await expect(leaderPage.getByText(m1.fullName)).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------------------------------------
  // Chế độ chấm trực tiếp
  // ---------------------------------------------------------------------------------------------------------

  await test.step("HD-02, HD-06 the Thư ký Phân công three thành viên chấm on the hồ sơ Chấm trực tiếp and Giao chấm", async () => {
    await assignAndStart(DIRECT_PRODUCT, [m1, m2, m3], []);
  });

  await test.step("TV-01 a thành viên not Phân công on the hồ sơ cannot open it", async () => {
    const p = pageOf(m4);
    await nav(p, "Hồ sơ được phân công");
    await expect(p.getByRole("row").filter({ hasText: DIRECT_PRODUCT })).toHaveCount(0);
    for (const url of [`/thanh-vien/ho-so/${directId}`, `/thanh-vien/diem-tong-hop/${directId}`]) {
      const res = await p.goto(url);
      expect(res?.status()).toBe(404);
      await expect(p.getByText(DIRECT_PRODUCT)).toHaveCount(0);
    }
  });

  await test.step("TV-05, TV-07 the first thành viên chấm on his own and xác nhận", async () => {
    const p = await openSheet(m1, DIRECT_PRODUCT);
    await expect(p.getByTestId("badge-advisory")).toHaveCount(0);
    await levelOf(p, "1.1", 50).check();
    await levelOf(p, "1.2", 50).check();
    await expect(p.getByTestId("sheet-total")).toHaveText("100");
    await p.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(p.getByRole("button", { name: "Đã lưu nháp" })).toBeVisible();
    await confirmSheet(m1, p);
  });

  await test.step("TV-05 the second thành viên does not see the first's phiếu, chấm and xác nhận: Sẵn sàng chốt", async () => {
    const p = await openSheet(m2, DIRECT_PRODUCT);
    await expect(p.getByText(m1.fullName)).toHaveCount(0);
    await expect(p.getByTestId("sheet-total")).toHaveText("0");
    // Neither does the Điểm tổng hợp page show anyone's points before Sẵn sàng chốt.
    await p.goto(`/thanh-vien/diem-tong-hop/${directId}`);
    await expect(p.getByTestId("aggregate-table")).toHaveCount(0);
    await expect(p.getByText(m1.fullName)).toHaveCount(0);
    await openSheet(m2, DIRECT_PRODUCT);
    await levelOf(p, "1.1", 25).check();
    await levelOf(p, "1.2", 25).check();
    await confirmSheet(m2, p);
    await expect(heading(p)).toContainText("Thành viên xác nhận");
  });

  await test.step("HD-04 at Sẵn sàng chốt the Thư ký sees every thành viên's points; the third shows Đang chấm", async () => {
    await nav(secretaryPage, "Tiến độ chấm");
    await expect(secretaryPage.getByText(DIRECT_PRODUCT)).toBeVisible();
    await secretaryPage.goto(`/hoi-dong/chot-diem/${directId}`);
    const table = secretaryPage.getByTestId("aggregate-table");
    await expect(table.getByRole("columnheader", { name: m1.fullName })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: m2.fullName })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: new RegExp(m3.fullName) })).toContainText("Đang chấm");
    await expect(table.getByRole("row", { name: /Tổng Phần A/ })).toContainText("100");
    await expect(table.getByRole("row", { name: /Tổng Phần A/ })).toContainText("50");
  });

  await test.step("HD-05 the Thư ký Trả phiếu of the second thành viên with a lý do: the hồ sơ goes back to Thành viên xem xét", async () => {
    const row = secretaryPage.getByRole("listitem").filter({ hasText: m2.fullName }).filter({ has: secretaryPage.getByTestId("return-sheet") });
    await row.getByTestId("return-sheet").click();
    const dialog = secretaryPage.getByRole("dialog");
    await dialog.getByLabel("Lý do").fill("Đề nghị xem lại Tiêu chí 1.1 sau thảo luận");
    await dialog.getByRole("button", { name: "Trả phiếu" }).click();
    await expect(heading(secretaryPage)).toContainText("Thành viên xem xét");
    await expect(secretaryPage.getByTestId("not-ready")).toContainText("1 / 2");
  });

  await test.step("TV-05 the thành viên is told why, chấm lần 2 from the prefilled phiếu and xác nhận again", async () => {
    const p = pageOf(m2);
    // The notice comes through the outbox and the worker, so it may land a moment after the Trả phiếu.
    await expect(async () => {
      await p.goto("/thong-bao");
      await expect(p.getByText(/Đề nghị xem lại Tiêu chí 1\.1 sau thảo luận/).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await openSheet(m2, DIRECT_PRODUCT);
    await expect(p.getByText(/lần chấm 2/i).first()).toBeVisible();
    await expect(p.getByTestId("sheet-total")).toHaveText("50");
    await levelOf(p, "1.1", 50).check();
    await expect(p.getByTestId("sheet-total")).toHaveText("75");
    await confirmSheet(m2, p);
    await expect(heading(p)).toContainText("Thành viên xác nhận");
  });

  let meetingUrl = "";
  await test.step("HD-09, HD-08 the Thư ký lập the Phiên họp and the Chủ tịch chốt with the third thành viên Vắng", async () => {
    meetingUrl = await createMeeting(`Đợt trực tiếp E2E ${stamp}`, DIRECT_PRODUCT, "Phiên họp chấm trực tiếp");
    const p = await finalize(chair, directId);
    const banner = p.getByTestId("finalized");
    await expect(banner).toContainText("4 sao, 87,5");
    await expect(banner).toContainText(`${chair.fullName} chốt lúc`);
    await expect(banner).toContainText(`Vắng: ${m3.fullName}`);
  });

  await test.step("HD-10, HD-11 the Thư ký prints the văn bản họp, uploads the biên bản đã ký and Kết thúc the Phiên họp", async () => {
    await secretaryPage.goto(meetingUrl);
    await expect(secretaryPage.getByText("Số liệu đã chốt")).toBeVisible();
    for (const name of [/Bảng tổng hợp điểm/, /biên bản/i, /quyết định/i]) {
      const [file] = await Promise.all([secretaryPage.waitForEvent("download"), secretaryPage.getByRole("link", { name }).click()]);
      expect(await file.failure()).toBeNull();
      expect(file.suggestedFilename()).toMatch(/\.docx$/);
    }
    await secretaryPage.getByLabel(/Tải lên bản đã ký/).setInputFiles(pdf("Bien-ban-hop-da-ky.pdf"));
    await secretaryPage.getByRole("button", { name: "Tải lên", exact: true }).click();
    await expect(secretaryPage.getByTestId("meeting-minutes")).toContainText("Đã ký · bản 1");
    await expect(secretaryPage.getByRole("button", { name: "Tải PDF" })).toBeVisible({ timeout: 90_000 });
    const [minutes] = await Promise.all([secretaryPage.waitForEvent("download"), secretaryPage.getByRole("button", { name: "Tải PDF" }).click()]);
    expect(minutes.suggestedFilename()).toMatch(/\.pdf$/);
    await secretaryPage.getByRole("button", { name: "Kết thúc Phiên họp" }).click();
    await expect(secretaryPage.getByRole("button", { name: "Kết thúc Phiên họp" })).toHaveCount(0);
  });

  await test.step("TV-08 after chốt the thành viên sees the Điểm tổng hợp", async () => {
    const p = pageOf(m1);
    await nav(p, "Điểm tổng hợp");
    await openRow(p, DIRECT_PRODUCT);
    await expect(p.getByTestId("aggregate-table").getByRole("columnheader", { name: m2.fullName })).toBeVisible();
  });

  // ---------------------------------------------------------------------------------------------------------
  // Chủ thể, audit and outbox
  // ---------------------------------------------------------------------------------------------------------

  await test.step("CT-12 the Chủ thể sees the mốc on the dòng thời gian, and no thành viên or phiếu", async () => {
    for (const [url, milestones] of [
      [advisoryOwnerUrl, ["Sở tiếp nhận tại tỉnh", "Hội đồng giao thẩm định", "Hội đồng chốt điểm"]],
      [directOwnerUrl, ["Sở tiếp nhận tại tỉnh", "Hội đồng giao chấm", "Hội đồng chốt điểm"]],
    ] as const) {
      await ownerPage.goto(url);
      await expect(heading(ownerPage)).toContainText("Đã chốt điểm");
      const timeline = ownerPage.getByRole("region", { name: "Dòng thời gian" }).or(ownerPage.locator("section").filter({ has: ownerPage.getByRole("heading", { name: "Dòng thời gian" }) }));
      for (const m of milestones) await expect(timeline.first()).toContainText(m);
      await expect(timeline.first()).not.toContainText("dossier.");
      for (const who of [m1, m2, m3, leader, secretary]) await expect(ownerPage.getByText(who.fullName)).toHaveCount(0);
      await expect(ownerPage.getByText("Phiếu chấm")).toHaveCount(0);
    }
  });

  await test.step("Every transition of both hồ sơ left an audit row and an outbox event", async () => {
    for (const id of [advisoryId, directId]) {
      const [[version]] = sql(`SELECT version FROM dossier.dossier WHERE id = '${id}'`) as [[string]];
      // Each hồ sơ version is the after-state of exactly one audited write.
      const audited = sql(
        `SELECT (after->>'version')::int AS v, count(*) FROM platform.audit_log WHERE target_type = 'dossier' AND target_id = '${id}' AND after ? 'version' GROUP BY v ORDER BY v`,
      );
      expect(audited.map(([v, n]) => [Number(v), Number(n)])).toEqual(Array.from({ length: Number(version) }, (_, i) => [i + 1, 1]));
      // Each audited transition of the hồ sơ has its outbox event; a Phiếu chấm nháp save is audited but moves no version.
      const [[auditCount]] = sql(`SELECT count(*) FROM platform.audit_log WHERE target_type = 'dossier' AND target_id = '${id}' AND action LIKE 'dossier.%' AND after ? 'version'`) as [[string]];
      const [[outboxCount]] = sql(`SELECT count(*) FROM platform.outbox WHERE payload->>'dossierId' = '${id}' AND type LIKE 'dossier.%'`) as [[string]];
      expect(Number(outboxCount)).toBeGreaterThanOrEqual(Number(auditCount));
      const actions = sql(`SELECT DISTINCT action FROM platform.audit_log WHERE target_id = '${id}' OR metadata->>'dossierId' = '${id}'`).map(([a]) => a);
      expect(actions).toEqual(expect.arrayContaining(["dossier.province_receive", "dossier.assignment.edit", "dossier.score_sheet.confirm", "dossier.finalize", "scoring.result.finalized"]));
      const events = sql(`SELECT DISTINCT type FROM platform.outbox WHERE payload->>'dossierId' = '${id}'`).map(([t]) => t);
      expect(events).toEqual(expect.arrayContaining(["dossier.province_received", "dossier.grading_started", "dossier.score_sheet_confirmed", "dossier.score_finalized"]));
    }
    const advisoryActions = sql(`SELECT DISTINCT action FROM platform.audit_log WHERE target_id = '${advisoryId}'`).map(([a]) => a);
    expect(advisoryActions).toEqual(expect.arrayContaining(["dossier.advisory_report.edit", "dossier.advisory_report.issue", "dossier.advisory_copy"]));
    const directActions = sql(`SELECT DISTINCT action FROM platform.audit_log WHERE target_id = '${directId}'`).map(([a]) => a);
    expect(directActions).toEqual(expect.arrayContaining(["dossier.score_sheet.return_unready"]));
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
