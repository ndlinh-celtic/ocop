"use server";

import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { withReauth } from "@/server/with-reauth";
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

/** The sample sensitive action of step 1 (spec #1): proves the Xác thực lại guard end to end. */
export async function sensitiveSampleAction() {
  const actor = await requireActor();
  return withReauth(async () => {
    const proof = await app().core.identity.sensitiveSample(actor);
    return { at: proof.at.toISOString(), method: proof.method };
  });
}
