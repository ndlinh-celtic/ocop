"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { CodeFormState } from "@/components/code-form";
import { app } from "@/server/app";
import { anonymous } from "@/server/request";
import { sessionToken } from "@/server/session";

const input = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

export async function verifyCodeAction(_prev: CodeFormState, form: FormData): Promise<CodeFormState> {
  const token = await sessionToken();
  if (!token) redirect("/dang-nhap");
  const parsed = input.safeParse({ code: form.get("code") });
  if (!parsed.success) return { error: "Nhập mã gồm 6 chữ số" };
  const result = await app().core.identity.verifySignInTotp(await anonymous(), { sessionToken: token, code: parsed.data.code });
  if (result.ok) redirect("/");
  if (result.reason === "expired") redirect("/dang-nhap?het-han=1");
  if (result.reason === "locked") redirect("/dang-nhap?tam-khoa=1");
  return { error: "Mã không đúng hoặc đã dùng. Nhập mã mới trên ứng dụng xác thực." };
}
