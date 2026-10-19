import { expect, test } from "@playwright/test";
import { latestEmail, signInAsAdmin } from "./support";

/**
 * Spec #1 walking skeleton: proves the pieces are wired together. The rules themselves are covered
 * by the use-case tests in packages/infra/test.
 */
test("L20 Quản trị creates a Cán bộ xã, who activates by email and lands in their own shell", async ({ page, browser }) => {
  const stamp = Date.now();
  const officer = { email: `canbo.xa.${stamp}@ocop.local`, fullName: `Cán bộ Xã ${stamp}`, password: "can-bo-xa-12345" };

  await test.step("Quản trị signs in with password and TOTP", async () => {
    await signInAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Xin chào Quản trị E2E" })).toBeVisible();
  });

  await test.step("Quản trị creates the account and grants Cán bộ xã on a ward", async () => {
    await page.getByRole("link", { name: "Tài khoản và vai trò" }).first().click();
    await page.getByLabel("Họ tên").fill(officer.fullName);
    await page.getByLabel("Email").fill(officer.email);
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(page.getByRole("status")).toContainText(officer.email);
    await page.getByRole("link", { name: officer.fullName }).click();
    await page.getByLabel("Vai trò").selectOption({ label: "Cán bộ xã" });
    await page.getByLabel("Xã/phường").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Gán vai trò" }).click();
    await expect(page.getByRole("status")).toHaveText("Đã gán vai trò");
  });

  const officerPage = await (await browser.newContext()).newPage();

  await test.step("the officer opens the activation email and sets a password", async () => {
    const text = await latestEmail(officer.email, /Kích hoạt tài khoản/);
    const link = /https?:\/\/\S+\/kich-hoat\?token=[\w-]+/.exec(text)![0];
    await officerPage.goto(link);
    await expect(officerPage.getByText(officer.fullName)).toBeVisible();
    await officerPage.getByLabel(/Mật khẩu mới/).fill(officer.password);
    await officerPage.getByLabel("Nhập lại mật khẩu").fill(officer.password);
    await officerPage.getByRole("button", { name: "Kích hoạt tài khoản" }).click();
    await officerPage.waitForURL(/\/dang-nhap\?kich-hoat=1$/);
  });

  await test.step("the officer signs in and sees the Cán bộ xã shell and the Phân vai notice", async () => {
    await officerPage.getByLabel("Email").fill(officer.email);
    await officerPage.getByLabel("Mật khẩu").fill(officer.password);
    await officerPage.getByRole("button", { name: "Đăng nhập" }).click();
    await officerPage.waitForURL("/");
    await expect(officerPage.getByText("Cán bộ xã ·").first()).toBeVisible();
    await expect(officerPage.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Hồ sơ tại xã" })).toBeVisible();
    // The notification is written by the worker; reload until it is there.
    await expect(async () => {
      await officerPage.reload();
      await expect(officerPage.getByTestId("unread-count")).toHaveText("1");
    }).toPass({ timeout: 60_000 });
    await officerPage.getByTestId("notification-bell").click();
    await expect(officerPage.getByText("Bạn được phân vai Cán bộ xã")).toBeVisible();
  });
});
