"use server";

import { app } from "./app";
import { requireActor } from "./session";

export type { ReauthNeeded } from "./with-reauth";

export async function reauthAction(proof: { code?: string; password?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await app().core.identity.reauthenticate(await requireActor(), proof);
  if (result.ok) return { ok: true };
  const error =
    result.reason === "locked"
      ? "Tài khoản tạm khóa do nhập sai nhiều lần."
      : result.reason === "totp_required"
        ? "Cần mã xác thực từ ứng dụng."
        : proof.code
          ? "Mã không đúng hoặc đã dùng."
          : "Mật khẩu không đúng.";
  return { ok: false, error };
}
