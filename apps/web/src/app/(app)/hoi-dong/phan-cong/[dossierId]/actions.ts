"use server";

import { revalidatePath } from "next/cache";
import { ASSIGNMENT_KINDS } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ReplaceFormState {
  error?: string;
  saved?: boolean;
}

const replace = z.object({ userId: z.string().min(1), newUserId: z.string().min(1), reason: z.string().trim().min(1).max(2_000) });
const add = z.object({ userId: z.string().min(1), kind: z.enum(ASSIGNMENT_KINDS), reason: z.string().trim().min(1).max(2_000) });

/** L09 HD-03 (stories 34 to 36): thay one Phân công in force by another person of the same kind. */
export async function replaceAssignmentAction(dossierId: string, expectedVersion: number, _prev: ReplaceFormState, form: FormData): Promise<ReplaceFormState> {
  const actor = await requireActor();
  const parsed = replace.safeParse({ userId: form.get("userId"), newUserId: form.get("newUserId"), reason: form.get("reason") });
  if (!parsed.success) return { error: "Chọn người bị thay, người thay và nhập lý do" };
  try {
    await app().core.councils.replaceAssignment(actor, { dossierId, expectedVersion, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/phan-cong/${dossierId}`);
  return { saved: true };
}

/** L09 HD-03 (stories 36, 37): bổ sung a thành viên chấm or Thành viên Tổ tư vấn, in force at once. */
export async function addAssignmentAction(dossierId: string, expectedVersion: number, _prev: ReplaceFormState, form: FormData): Promise<ReplaceFormState> {
  const actor = await requireActor();
  // "<kind>:<userId>", one picker for both kinds.
  const [kind, userId] = String(form.get("person") ?? "").split(":");
  const parsed = add.safeParse({ userId, kind, reason: form.get("reason") });
  if (!parsed.success) return { error: "Chọn người bổ sung và nhập lý do" };
  try {
    await app().core.councils.addAssignment(actor, { dossierId, expectedVersion, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/phan-cong/${dossierId}`);
  return { saved: true };
}
