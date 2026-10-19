import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { generate } from "otplib";

export const ADMIN = { email: "quantri.e2e@ocop.local", fullName: "Quản trị E2E", password: "quan-tri-e2e-12345" };
export const STATE_FILE = path.resolve(import.meta.dirname, "../.state/admin.json");
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

interface State {
  totpSecret?: string;
  lastStep?: number;
}
const readState = (): State => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {});
const writeState = (s: State) => writeFileSync(STATE_FILE, JSON.stringify(s));

/** A code for a step the server has not seen yet (codes are single-use per 30-second step). */
async function freshCode(secret: string) {
  const state = readState();
  let step = Math.floor(Date.now() / 30_000);
  if (state.lastStep !== undefined && step <= state.lastStep) {
    await new Promise((r) => setTimeout(r, (state.lastStep! + 1) * 30_000 - Date.now() + 500));
    step = Math.floor(Date.now() / 30_000);
  }
  writeState({ ...state, lastStep: step });
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
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    writeState({ totpSecret: secret });
    await page.getByLabel("Mã xác thực 6 số").fill(await freshCode(secret));
    await page.getByRole("button", { name: "Bật xác thực hai lớp" }).click();
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
