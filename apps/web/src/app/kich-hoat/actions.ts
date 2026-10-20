"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requestContext } from "@/server/request";

export interface ActivateState {
  error?: string;
}

const input = z
  .object({ password: z.string().min(1), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Hai lần nhập mật khẩu không khớp" });

export async function activateAction(token: string, _prev: ActivateState, form: FormData): Promise<ActivateState> {
  const parsed = input.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nhập mật khẩu" };
  let result;
  try {
    result = await app().core.identity.activateAccount({ token, password: parsed.data.password }, await requestContext());
  } catch (err) {
    return { error: domainMessage(err) };
  }
  if (!result.ok) return { error: "Liên kết không còn hiệu lực. Liên hệ Quản trị để được gửi lại." };
  redirect("/dang-nhap?kich-hoat=1");
}
