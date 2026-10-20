"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface CreateUserState {
  error?: string;
  created?: string;
}

const input = z.object({ email: z.string().trim().min(1), fullName: z.string().trim().min(1) });

export async function createUserAction(_prev: CreateUserState, form: FormData): Promise<CreateUserState> {
  const actor = await requireActor();
  const parsed = input.safeParse({ email: form.get("email"), fullName: form.get("fullName") });
  if (!parsed.success) return { error: "Nhập email và họ tên" };
  try {
    await app().core.identity.createStaffUser(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/quan-tri/nguoi-dung");
  return { created: parsed.data.email };
}

export async function resendActivationAction(userId: string) {
  const actor = await requireActor();
  await app().core.identity.resendActivation(actor, userId);
  revalidatePath("/quan-tri/nguoi-dung");
}
