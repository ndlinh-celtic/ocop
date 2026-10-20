"use server";

import { z } from "zod";
import { app } from "./app";
import { requireActor } from "./session";

export type { ReauthNeeded } from "./with-reauth";

const input = z.object({ code: z.string().trim().regex(/^\d{6}$/).optional(), password: z.string().min(1).optional() });

export async function reauthAction(raw: { code?: string; password?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: raw.code !== undefined ? "Nhập mã gồm 6 chữ số." : "Nhập mật khẩu." };
  const proof = parsed.data;
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
