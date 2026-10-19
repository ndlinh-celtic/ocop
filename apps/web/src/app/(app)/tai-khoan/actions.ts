"use server";

import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ChangePasswordState {
  error?: string;
  ok?: boolean;
}

export async function changePasswordAction(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const actor = await requireActor();
  const newPassword = String(form.get("newPassword") ?? "");
  if (newPassword !== String(form.get("confirm") ?? "")) return { error: "Hai lần nhập mật khẩu mới không khớp" };
  try {
    await app().core.identity.changePassword(actor, { currentPassword: String(form.get("currentPassword") ?? ""), newPassword });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return { ok: true };
}
