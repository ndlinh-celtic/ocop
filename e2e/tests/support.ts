import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { generate } from "otplib";

export const ADMIN = { email: "quantri.e2e@ocop.local", fullName: "Quản trị E2E", password: "quan-tri-e2e-12345" };
export const STATE_FILE = path.resolve(import.meta.dirname, "../.state/admin.json");
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

interface State {
  totpSecret?: string;
  /** The last TOTP step used, per secret: a code is single-use per step and account. */
  lastSteps?: Record<string, number>;
}
const readState = (): State => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {});
const writeState = (s: State) => writeFileSync(STATE_FILE, JSON.stringify(s));

/** A code for a step the server has not seen yet for this secret (codes are single-use per 30-second step). */
export async function freshCode(secret: string) {
  const last = readState().lastSteps?.[secret];
  let step = Math.floor(Date.now() / 30_000);
  if (last !== undefined && step <= last) {
    await new Promise((r) => setTimeout(r, (last + 1) * 30_000 - Date.now() + 500));
    step = Math.floor(Date.now() / 30_000);
  }
  const state = readState();
  writeState({ ...state, lastSteps: { ...state.lastSteps, [secret]: step } });
  return generate({ secret, epoch: step * 30 });
}

/** Signs the first Quản trị in; enrols TOTP on the first run and remembers the secret. */
export async function signInAsAdmin(page: Page) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Mật khẩu").fill(ADMIN.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(dang-ky-totp|dang-nhap\/ma-xac-thuc)$/);
  if (page.url().endsWith("/dang-ky-totp")) {
    writeState({ ...readState(), totpSecret: await enrolTotp(page) });
  } else {
    const secret = readState().totpSecret;
    if (!secret) throw new Error("Admin has TOTP but its secret was not saved; reset the stack");
    await page.getByLabel("Mã xác thực 6 số").fill(await freshCode(secret));
    await page.getByRole("button", { name: "Xác nhận" }).click();
  }
  await page.waitForURL("/");
}

/** Waits for the newest email to `to` and returns its plain text, via Mailpit's API. */
export async function latestEmail(to: string, subject: RegExp): Promise<string> {
  let text = "";
  await expect
    .poll(
      async () => {
        const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
        const msg = (list.messages as { ID: string; Subject: string }[]).find((m) => subject.test(m.Subject));
        if (!msg) return false;
        text = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()).Text;
        return true;
      },
      { timeout: 60_000, intervals: [1000] },
    )
    .toBe(true);
  return text;
}

/** Enrols TOTP on /dang-ky-totp and returns the secret, for codes later (sign-in, Xác thực lại). */
export async function enrolTotp(page: Page) {
  await page.waitForURL(/\/dang-ky-totp$/);
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Mã xác thực 6 số").fill(await freshCode(secret));
  await page.getByRole("button", { name: "Bật xác thực hai lớp" }).click();
  return secret;
}

/** Opens the newest activation email to `email` and sets the password; activation signs the user in. */
export async function activateFromEmail(page: Page, email: string, password: string) {
  const text = await latestEmail(email, /Kích hoạt tài khoản/);
  const link = /https?:\/\/\S+\/kich-hoat\?token=[\w-]+/.exec(text)![0];
  await page.goto(link);
  await page.getByLabel(/Mật khẩu mới/).fill(password);
  await page.getByLabel("Nhập lại mật khẩu").fill(password);
  await page.getByRole("button", { name: "Kích hoạt tài khoản" }).click();
}

/** A small PDF the scanner and the type check accept, as a file for an <input type="file">. */
export function pdf(name: string) {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n${name}\n`;
  return { name, mimeType: "application/pdf", buffer: Buffer.from(body) };
}

/** YYYY-MM-DD in giờ Việt Nam, `days` from today. */
export function vnDate(days = 0) {
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}
