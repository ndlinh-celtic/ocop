"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { formatVnTime } from "@/lib/format";
import { app } from "@/server/app";
import { anonymous } from "@/server/request";
import { setSessionCookie } from "@/server/session";

const input = z.object({ email: z.string().trim().min(3), password: z.string().min(1) });

export interface SignInState {
  error?: string;
}

export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = input.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Nhập email và mật khẩu" };
  const result = await app().core.identity.signIn(await anonymous(), parsed.data);
  if (!result.ok && result.reason === "locked") {
    return { error: `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${formatVnTime(result.until)}.` };
  }
  if (!result.ok) return { error: "Email hoặc mật khẩu không đúng" };
  await setSessionCookie(result.sessionToken);
  redirect(result.stage === "full" ? "/" : result.stage === "totp_pending" ? "/dang-nhap/ma-xac-thuc" : "/dang-ky-totp");
}
