"use server";

import { redirect } from "next/navigation";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requestContext } from "@/server/request";

export interface ResetState {
  error?: string;
}

export async function resetPasswordAction(token: string, _prev: ResetState, form: FormData): Promise<ResetState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "Hai lần nhập mật khẩu không khớp" };
  let result;
  try {
    result = await app().core.identity.resetPassword({ token, password }, await requestContext());
  } catch (err) {
    return { error: domainMessage(err) };
  }
  if (!result.ok) return { error: "Liên kết không còn hiệu lực. Yêu cầu liên kết mới." };
  redirect("/dang-nhap?dat-lai=1");
}
