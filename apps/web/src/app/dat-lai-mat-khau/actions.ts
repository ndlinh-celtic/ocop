"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { anonymous } from "@/server/request";

export interface ResetState {
  error?: string;
}

const input = z
  .object({ password: z.string().min(1), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Hai lần nhập mật khẩu không khớp" });

export async function resetPasswordAction(token: string, _prev: ResetState, form: FormData): Promise<ResetState> {
  const parsed = input.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nhập mật khẩu" };
  let result;
  try {
    result = await app().core.identity.resetPassword(await anonymous(), { token, password: parsed.data.password });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  if (!result.ok) return { error: "Liên kết không còn hiệu lực. Yêu cầu liên kết mới." };
  redirect("/dang-nhap?dat-lai=1");
}
