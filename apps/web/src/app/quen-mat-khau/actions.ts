"use server";

import { app } from "@/server/app";
import { requestContext } from "@/server/request";

export interface ForgotState {
  sent?: boolean;
}

export async function forgotPasswordAction(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const email = String(form.get("email") ?? "").trim();
  if (email) await app().core.identity.requestPasswordReset(email, await requestContext());
  // Same answer whether or not the email has an account.
  return { sent: true };
}
