"use server";

import { redirect } from "next/navigation";
import type { CodeFormState } from "@/components/code-form";
import { app } from "@/server/app";
import { requestContext } from "@/server/request";
import { sessionToken } from "@/server/session";

export async function verifyCodeAction(_prev: CodeFormState, form: FormData): Promise<CodeFormState> {
  const token = await sessionToken();
  if (!token) redirect("/dang-nhap");
  const result = await app().core.identity.verifySignInTotp(token, String(form.get("code") ?? ""), await requestContext());
  if (result.ok) redirect("/");
  if (result.reason === "expired") redirect("/dang-nhap?het-han=1");
  return { error: "Mã không đúng hoặc đã dùng. Nhập mã mới trên ứng dụng xác thực." };
}
