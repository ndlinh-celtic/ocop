"use server";

import { redirect } from "next/navigation";
import type { CodeFormState } from "@/components/code-form";
import { app } from "@/server/app";
import { requestContext } from "@/server/request";
import { sessionToken } from "@/server/session";

export async function confirmEnrollmentAction(_prev: CodeFormState, form: FormData): Promise<CodeFormState> {
  const token = await sessionToken();
  if (!token) redirect("/dang-nhap");
  const result = await app().core.identity.confirmTotpEnrollment(token, String(form.get("code") ?? ""), await requestContext());
  if (result.ok) redirect("/");
  if (result.reason === "expired") redirect("/dang-nhap?het-han=1");
  if (result.reason === "locked") redirect("/dang-nhap?tam-khoa=1");
  return { error: "Mã không đúng. Kiểm tra giờ trên điện thoại rồi nhập mã mới." };
}
