import { expect, test, type Browser, type Page } from "@playwright/test";
import { activateFromEmail, enrolTotp, latestEmail, pdf, signInAsAdmin, vnDate } from "./support";

/**
 * Spec #30 step 3 (#47): L01 to L06 through the real stack, one role per browser. The rules themselves
 * are covered by the use-case tests in packages/infra/test/dossiers; this proves the pages carry them.
 */

const stamp = Date.now();
/** From packages/infra/seed/wards.sample.csv, seeded by the global setup. */
const WARD = { name: "Phường Mẫu Trung Tâm", code: "90001" };
const OTHER_WARD = { name: "Phường Mẫu Bắc", code: "90002" };
const LEGAL_BASIS = `E2E ${stamp}/2026/QĐ-TTg`;
const PRODUCT = "Bưởi da xanh E2E";
const PASSWORD = "mat-khau-e2e-12345";

const person = (slug: string, fullName: string) => ({ email: `${slug}.${stamp}@ocop.local`, fullName });
const owner = { ...person("chu.the", `Hộ Nguyễn Văn E2E ${stamp}`), identifier: String(stamp).padStart(12, "0").slice(-12) };
const wardOfficer = person("can.bo.xa", `Cán bộ Trung Tâm ${stamp}`);
const otherWardOfficer = person("can.bo.xa.khac", `Cán bộ Bắc ${stamp}`);
const provinceOfficer = person("can.bo.so", `Cán bộ Sở ${stamp}`);

/** A one-set Phiên bản tiêu chí in the QĐ 26 extraction format: two Tiêu chí, so one can lack minh chứng. */
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
    ngay_ban_hanh: "2026-01-02",
    hieu_luc: "2026-02-01",
    bo_tieu_chi: [
      {
        bo: 1,
        ten_bo: "Rau củ quả tươi E2E",
        san_pham: "Thực phẩm",
        nhom: "Thực phẩm tươi sống",
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
  // window.confirm guards nộp, mở đợt and similar one-click actions.
  page.on("dialog", (d) => void d.accept());
  return page;
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name }).click();

/** Clicks a button that downloads a file and returns the file's suggested name. */
async function download(page: Page, name: string | RegExp, role: "button" | "link" = "button") {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole(role, { name }).first().click()]);
  expect(await file.failure()).toBeNull();
  return file.suggestedFilename();
}

test("L01–L06 Chủ thể registers and submits, the xã asks for bổ sung, assesses and gửi tỉnh, the Sở trả về", async ({ page, browser }) => {
  test.setTimeout(900_000);

  await test.step("Quản trị publishes a Phiên bản tiêu chí and creates the officers", async () => {
    await signInAsAdmin(page);
    await nav(page, "Bộ tiêu chí");
    await page.getByLabel(/Tệp JSON/).setInputFiles({ name: "tieu-chi-e2e.json", mimeType: "application/json", buffer: Buffer.from(criteriaJson()) });
    await page.getByRole("button", { name: "Nhập thành bản nháp" }).click();
    await page.getByRole("status").getByRole("link", { name: "Mở bản nháp" }).click();
    await page.getByRole("button", { name: "Phát hành" }).click();
    await page.getByRole("dialog", { name: "Phát hành phiên bản tiêu chí?" }).getByRole("button", { name: "Phát hành" }).click();
    await expect(page.getByText("Đã phát hành").first()).toBeVisible();

    for (const [who, role, ward] of [
      [wardOfficer, "Cán bộ xã", WARD],
      [otherWardOfficer, "Cán bộ xã", OTHER_WARD],
      [provinceOfficer, "Cán bộ Sở", null],
    ] as const) {
      await nav(page, "Người dùng và phân vai");
      await page.getByLabel("Họ tên").fill(who.fullName);
      await page.getByLabel("Email").fill(who.email);
      await page.getByRole("button", { name: "Thêm cán bộ" }).click();
      await expect(page.getByRole("status")).toContainText(who.email);
      await page.getByRole("link", { name: who.fullName }).click();
      await page.getByLabel("Vai trò").selectOption({ label: role });
      if (ward) await page.getByLabel("Xã/phường").selectOption({ label: `${ward.name} (${ward.code})` });
      await page.getByRole("button", { name: "Gán vai trò" }).click();
      await expect(page.getByRole("status")).toHaveText("Đã gán vai trò");
    }
  });

  const provincePage = await newPage(browser);
  await test.step("Cán bộ Sở activates, enrols TOTP and opens a Đợt đánh giá on that version", async () => {
    await activateFromEmail(provincePage, provinceOfficer.email, PASSWORD);
    await enrolTotp(provincePage);
    await provincePage.waitForURL("/");
    await nav(provincePage, "Đợt đánh giá");
    await provincePage.getByRole("link", { name: /Tạo đợt/ }).click();
    await provincePage.getByLabel("Tên đợt").fill(`Đợt E2E ${stamp}`);
    await provincePage.getByLabel("Hạn nộp xã").fill(vnDate(20));
    await provincePage.getByLabel("Hạn gửi tỉnh").fill(vnDate(40));
    await provincePage.getByLabel("Hạn đánh giá tỉnh").fill(vnDate(60));
    await provincePage.getByLabel("Phiên bản tiêu chí").selectOption({ label: `${LEGAL_BASIS} (ban hành 02/01/2026)` });
    await provincePage.getByRole("radio").first().check();
    await provincePage.getByRole("button", { name: "Tạo đợt (Nháp)" }).click();
    await provincePage.getByRole("button", { name: "Mở đợt" }).click();
    await expect(provincePage.getByText("Đang nhận nộp").first()).toBeVisible();
  });

  const ownerPage = await newPage(browser);
  /** Fills in and sends the S02 Đăng ký form for a hộ sản xuất. */
  async function register(page: Page, email: string) {
    await page.goto("/dang-ky");
    await page.getByText("Hộ sản xuất", { exact: true }).click();
    await page.getByLabel("Họ tên chủ hộ").fill(owner.fullName);
    await page.getByLabel("Số định danh cá nhân của chủ hộ").fill(owner.identifier);
    await page.getByLabel("Xã/phường").selectOption({ label: WARD.name });
    await page.getByLabel("Địa chỉ").fill(`Ấp 1, ${WARD.name}`);
    await page.getByLabel("Người đại diện").fill(owner.fullName);
    await page.getByLabel("Số điện thoại").fill("0901234567");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/Tôi đồng ý/).check();
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  }

  await test.step("CT-01 a hộ sản xuất registers and activates its account from the email", async () => {
    await register(ownerPage, owner.email);
    await expect(ownerPage.getByRole("heading", { name: "Kiểm tra hộp thư của bạn" })).toBeVisible();

    await activateFromEmail(ownerPage, owner.email, PASSWORD);
    await ownerPage.waitForURL("/");
    await expect(ownerPage.getByTestId("sidebar").getByText(`Chủ thể · ${owner.fullName}`)).toBeVisible();
  });

  await test.step("CT-01 a second registration with the same số định danh is refused with the neutral message", async () => {
    const visitor = await newPage(browser);
    await register(visitor, `khac.${owner.email}`);
    await expect(visitor.getByRole("alert").filter({ hasText: "Không thể đăng ký" })).toContainText("đã được dùng");
    await visitor.context().close();
  });

  await test.step("CT-02 the Chủ thể adds its giấy tờ pháp lý and becomes Đã xác thực", async () => {
    await nav(ownerPage, "Hồ sơ pháp lý");
    await expect(ownerPage.getByTestId("not-verified")).toBeVisible();
    await ownerPage.getByLabel("Loại giấy tờ").selectOption({ label: "Giấy chứng nhận đăng ký doanh nghiệp, hợp tác xã hoặc hộ kinh doanh" });
    await ownerPage.getByLabel("Số giấy tờ").fill("HKD-01");
    await ownerPage.getByLabel("Ngày cấp").fill("2025-01-15");
    await ownerPage.getByLabel("Tệp giấy tờ").setInputFiles(pdf("Giay-dang-ky-ho-kinh-doanh.pdf"));
    await ownerPage.getByRole("button", { name: "Thêm giấy tờ" }).click();
    // The giấy tờ counts once the virus scan finds it clean; the page refreshes itself meanwhile.
    await expect(ownerPage.getByTestId("verified")).toBeVisible({ timeout: 90_000 });
  });

  let dossierUrl = "";
  await test.step("CT-03 the Chủ thể creates a hồ sơ on a Bộ tiêu chí and fills in the product", async () => {
    await nav(ownerPage, "Hồ sơ của tôi");
    await ownerPage.getByRole("link", { name: "Tạo hồ sơ" }).click();
    await ownerPage.getByRole("radio", { name: /Rau củ quả tươi E2E/ }).check();
    await ownerPage.getByLabel("Tôi đã hiểu").check();
    await ownerPage.getByRole("button", { name: "Tạo hồ sơ" }).click();
    await ownerPage.waitForURL(/\/chu-the\/ho-so\/[0-9a-f-]{36}$/);
    dossierUrl = new URL(ownerPage.url()).pathname;

    await ownerPage.getByLabel("Tên sản phẩm").fill(PRODUCT);
    await ownerPage.getByLabel("Mô tả sản phẩm").fill("Bưởi trồng theo VietGAP");
    await ownerPage.getByLabel("Nguyên liệu").fill("Bưởi tươi");
    await ownerPage.getByLabel("Quy trình sản xuất").fill("Thu hái, phân loại, đóng gói");
    await ownerPage.getByLabel("Bao bì, nhãn mác").fill("Thùng carton 10 kg");
    await ownerPage.getByLabel("Công bố chất lượng").fill("Tự công bố số 01/2026");
    await ownerPage.getByLabel("Công bố chất lượng").blur();
    await expect(ownerPage.getByTestId("autosave-status")).toHaveText("Đã lưu tự động.");
  });

  await test.step("CT-05 the Chủ thể uploads minh chứng and ties it to Tiêu chí 1.1", async () => {
    await ownerPage.getByLabel("Tệp minh chứng").setInputFiles(pdf("Hop-dong-nguyen-lieu.pdf"));
    await ownerPage.getByRole("button", { name: "Tải lên" }).click();
    await expect(ownerPage.getByText("Đã quét sạch")).toBeVisible({ timeout: 90_000 });
    await ownerPage.getByText("Gắn với tiêu chí").click();
    await ownerPage.getByRole("checkbox", { name: /1\.1 Nguồn nguyên liệu/ }).check();
    await ownerPage.getByRole("button", { name: "Lưu gắn tiêu chí" }).click();
    await expect(ownerPage.getByText("Gắn với tiêu chí 1.1")).toBeVisible();
  });

  await test.step("CT-06 the Chủ thể tự chấm thử every Tiêu chí and sees the estimate", async () => {
    const levels = ownerPage.getByLabel("Mức điểm tự chấm");
    await expect(levels).toHaveCount(2);
    await levels.nth(0).selectOption({ label: "Đạt đầy đủ · 50 điểm" });
    await expect(levels.nth(0)).toBeEnabled();
    await levels.nth(1).selectOption({ label: "Đạt một phần · 25 điểm" });
    await expect(ownerPage.getByLabel("Ước lượng hạng sao")).toContainText("Tổng điểm: 75");
    await ownerPage.getByLabel("Giải trình").first().fill("Hợp đồng bao tiêu với 20 hộ trồng bưởi");
    await ownerPage.getByLabel("Giải trình").first().blur();
    // Saved on blur: it is still there after a reload, with the tự chấm.
    await expect(async () => {
      await ownerPage.reload();
      await expect(ownerPage.getByLabel("Giải trình").first()).toHaveValue("Hợp đồng bao tiêu với 20 hộ trồng bưởi", { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await expect(ownerPage.getByLabel("Ước lượng hạng sao")).toContainText("Tổng điểm: 75");
  });

  await test.step("CT-09 the Chủ thể submits the hồ sơ to the xã", async () => {
    await ownerPage.getByRole("button", { name: "Nộp hồ sơ" }).click();
    await expect(ownerPage.getByText("Phiên bản nộp 1")).toBeVisible();
    await expect(ownerPage.getByRole("heading", { level: 1 })).toContainText("Đã nộp xã");
    expect(await download(ownerPage, "Phiếu đăng ký (.docx)")).toMatch(/\.docx$/);
  });

  const wardPage = await newPage(browser);
  let wardDossierUrl = "";
  await test.step("XA-01, XA-02 the Cán bộ xã sees it waiting and Tiếp nhận it", async () => {
    await activateFromEmail(wardPage, wardOfficer.email, PASSWORD);
    await wardPage.waitForURL("/");
    await nav(wardPage, "Hồ sơ tại xã");
    await wardPage.getByRole("link", { name: "Chờ tiếp nhận" }).click();
    await wardPage.getByRole("link", { name: PRODUCT }).click();
    await wardPage.waitForURL(/\/xa\/ho-so\/[0-9a-f-]{36}$/);
    wardDossierUrl = new URL(wardPage.url()).pathname;
    await expect(wardPage.getByText("1 tiêu chí chưa có minh chứng: 1.2.")).toBeVisible();
    await wardPage.getByRole("button", { name: "Tiếp nhận" }).click();
    await expect(wardPage.getByText(/Đã tiếp nhận lúc/)).toBeVisible();
  });

  const otherWardPage = await newPage(browser);
  await test.step("XA-01 the Cán bộ xã of another xã cannot open the hồ sơ: the page is not found", async () => {
    await activateFromEmail(otherWardPage, otherWardOfficer.email, PASSWORD);
    await otherWardPage.waitForURL("/");
    await nav(otherWardPage, "Hồ sơ tại xã");
    await expect(otherWardPage.getByRole("link", { name: PRODUCT })).toHaveCount(0);
    const res = await otherWardPage.goto(wardDossierUrl);
    expect(res?.status()).toBe(404);
    await expect(otherWardPage.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
    await expect(otherWardPage.getByText(PRODUCT)).toHaveCount(0);
  });

  await test.step("XA-05 the Cán bộ xã asks for bổ sung on Tiêu chí 1.2", async () => {
    await wardPage.getByLabel("Nội dung 1").fill("Bổ sung hợp đồng liên kết sản xuất");
    await wardPage.getByLabel("Gắn với").selectOption({ label: "1.2 Liên kết sản xuất" });
    await wardPage.getByLabel(/Hạn bổ sung/).fill(vnDate(7));
    await wardPage.getByRole("button", { name: "Gửi yêu cầu bổ sung" }).click();
    await expect(wardPage.getByRole("heading", { level: 1 })).toContainText("Yêu cầu bổ sung");
  });

  await test.step("CT-11 the Chủ thể is told, adds the minh chứng, answers and nộp lại", async () => {
    // The email carries only a link to the hồ sơ, never its content.
    expect(await latestEmail(owner.email, /có yêu cầu bổ sung/)).toContain(dossierUrl);
    await ownerPage.goto(dossierUrl);
    await expect(ownerPage.getByText("Bổ sung hợp đồng liên kết sản xuất")).toBeVisible();
    await ownerPage.getByLabel("Tệp minh chứng").setInputFiles(pdf("Hop-dong-lien-ket.pdf"));
    await ownerPage.getByRole("button", { name: "Tải lên" }).click();
    await expect(ownerPage.getByText("Đã quét sạch")).toHaveCount(2, { timeout: 90_000 });
    const file = ownerPage.getByRole("listitem").filter({ hasText: "Hop-dong-lien-ket.pdf" });
    await file.getByText("Gắn với tiêu chí").click();
    await file.getByRole("checkbox", { name: /1\.2 Liên kết sản xuất/ }).check();
    await file.getByRole("button", { name: "Lưu gắn tiêu chí" }).click();
    await expect(ownerPage.getByText("Gắn với tiêu chí 1.2")).toBeVisible();
    await ownerPage.getByLabel("Trả lời").fill("Đã bổ sung hợp đồng liên kết với HTX");
    await ownerPage.getByRole("button", { name: "Lưu câu trả lời" }).click();
    await expect(ownerPage.getByText("Đã lưu.")).toBeVisible();
    await ownerPage.getByRole("button", { name: "Nộp lại hồ sơ" }).click();
    await expect(ownerPage.getByText("Phiên bản nộp 2")).toBeVisible();
  });

  await test.step("XA-04 the Cán bộ xã assesses the Checklist sơ bộ", async () => {
    await wardPage.goto(wardDossierUrl);
    await expect(wardPage.getByText("Phiên bản nộp 2")).toBeVisible();
    const items = wardPage.getByRole("group", { name: /Kết quả mục/ });
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await items.nth(i).getByLabel("Đạt", { exact: true }).check();
    await wardPage.getByRole("button", { name: "Lưu Checklist sơ bộ" }).click();
    await expect(wardPage.getByText("Đã lưu", { exact: true })).toBeVisible();
    await expect(wardPage.getByText("Đủ điều kiện chuyển tỉnh").first()).toBeVisible();
  });

  await test.step("XA-07 the Cán bộ xã downloads the Báo cáo, uploads the signed copy and gửi tỉnh", async () => {
    await wardPage.getByRole("link", { name: "Lập báo cáo và gửi lên tỉnh" }).click();
    expect(await download(wardPage, "Tải bản nháp (Word)", "link")).toMatch(/\.docx$/);
    await expect(wardPage.getByRole("button", { name: "Gửi lên tỉnh" })).toBeDisabled();
    await wardPage.getByLabel(/Tải lên bản đã ký/).setInputFiles(pdf("Bao-cao-xa-da-ky.pdf"));
    await wardPage.getByRole("button", { name: "Tải lên", exact: true }).click();
    await expect(wardPage.getByRole("button", { name: "Tải bản đã ký (.pdf)" })).toBeVisible({ timeout: 90_000 });
    expect(await download(wardPage, "Tải bản đã ký (.pdf)")).toMatch(/\.pdf$/);
    await wardPage.getByRole("button", { name: "Gửi lên tỉnh" }).click();
    await wardPage.getByRole("button", { name: "Xác nhận gửi" }).click();
    await wardPage.waitForURL(wardDossierUrl);
    await expect(wardPage.getByRole("heading", { level: 1 })).toContainText("Đã chuyển tỉnh");
    await expect(wardPage.getByText(/Báo cáo đánh giá cấp xã đã ký: Bao-cao-xa-da-ky.pdf/)).toBeVisible();
  });

  await test.step("the Cán bộ Sở sees the hồ sơ at the province and trả về for bổ sung", async () => {
    await nav(provincePage, "Hồ sơ toàn tỉnh");
    await provincePage.getByRole("link", { name: PRODUCT }).click();
    await expect(provincePage.getByRole("heading", { level: 1 })).toContainText("Đã chuyển tỉnh");
    await expect(provincePage.getByText(/Báo cáo đánh giá cấp xã đã ký/)).toBeVisible();
    await provincePage.getByLabel("Nội dung 1").fill("Bổ sung giấy chứng nhận an toàn thực phẩm");
    await provincePage.getByLabel(/Hạn bổ sung/).fill(vnDate(10));
    await provincePage.getByRole("button", { name: "Trả hồ sơ về Yêu cầu bổ sung" }).click();
    await expect(provincePage.getByRole("heading", { level: 1 })).toContainText("Yêu cầu bổ sung");
  });

  await test.step("the Chủ thể is told of the trả về of the Sở and sees it on its hồ sơ", async () => {
    expect(await latestEmail(owner.email, /được Sở trả về để bổ sung/)).toContain(dossierUrl);
    await ownerPage.goto(dossierUrl);
    await expect(ownerPage.getByRole("heading", { level: 1 })).toContainText("Yêu cầu bổ sung");
    await expect(ownerPage.getByText("Bổ sung giấy chứng nhận an toàn thực phẩm")).toBeVisible();
  });
});
