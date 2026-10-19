"use server";

import { redirect } from "next/navigation";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requestContext } from "@/server/request";

export interface ActivateState {
  error?: string;
}

export async function activateAction(token: string, _prev: ActivateState, form: FormData): Promise<ActivateState> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "Hai lần nhập mật khẩu không khớp" };
  let result;
  try {
    result = await app().core.identity.activateAccount({ token, password }, await requestContext());
  } catch (err) {
    return { error: domainMessage(err) };
  }
  if (!result.ok) return { error: "Liên kết không còn hiệu lực. Liên hệ Quản trị để được gửi lại." };
  redirect("/dang-nhap?kich-hoat=1");
}
