"use server";

import { ROLES, type Role } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface GrantState {
  error?: string;
  ok?: boolean;
}

const input = z.object({
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
  scopeId: z.string().uuid().or(z.literal("")).transform((v) => v || null),
  validFrom: z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00+07:00`) : undefined)),
});

export async function grantRoleAction(userId: string, _prev: GrantState, form: FormData): Promise<GrantState> {
  const actor = await requireActor();
  const parsed = input.safeParse({ role: form.get("role"), scopeId: form.get("scopeId") ?? "", validFrom: form.get("validFrom") || undefined });
  if (!parsed.success) return { error: "Chọn vai trò và phạm vi" };
  try {
    await app().core.identity.grantRole(actor, { userId, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/quan-tri/nguoi-dung/${userId}`);
  return { ok: true };
}

export async function revokeRoleAction(userId: string, assignmentId: string) {
  await app().core.identity.revokeRole(await requireActor(), { assignmentId });
  revalidatePath(`/quan-tri/nguoi-dung/${userId}`);
}
