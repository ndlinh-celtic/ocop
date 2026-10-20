"use server";

import { z } from "zod";
import { app } from "@/server/app";
import { anonymous } from "@/server/request";

export interface ForgotState {
  sent?: boolean;
}

const input = z.object({ email: z.string().trim().min(3) });

export async function forgotPasswordAction(_prev: ForgotState, form: FormData): Promise<ForgotState> {
  const parsed = input.safeParse({ email: form.get("email") });
  if (parsed.success) await app().core.identity.requestPasswordReset(await anonymous(), { email: parsed.data.email });
  // Same answer whether or not the email has an account.
  return { sent: true };
}
