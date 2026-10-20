"use server";

import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { withReauth } from "@/server/with-reauth";
import { requireActor } from "@/server/session";

export interface ChangePasswordState {
  error?: string;
  ok?: boolean;
}

const input = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(1), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: "Hai lần nhập mật khẩu mới không khớp" });

export async function changePasswordAction(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const actor = await requireActor();
  const parsed = input.safeParse({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nhập đủ các ô mật khẩu" };
  const { currentPassword, newPassword } = parsed.data;
  try {
    await app().core.identity.changePassword(actor, { currentPassword, newPassword });
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
