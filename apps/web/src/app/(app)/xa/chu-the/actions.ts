"use server";

import { ENTITY_KINDS } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const LIST = "/xa/chu-the";
const text = z.string().trim().min(1);
const entityInput = z.object({
  kind: z.enum(ENTITY_KINDS),
  name: text,
  identifier: text,
  address: text,
  representativeName: text,
  phone: text,
  email: text,
});

export interface CreateEntityState {
  error?: string;
  values?: Partial<Record<keyof z.infer<typeof entityInput>, string>>;
}

/** Story 11: the Cán bộ xã opens a Chủ thể of their xã; its Người dùng đại diện gets the activation email. */
export async function createEntityAction(_prev: CreateEntityState, form: FormData): Promise<CreateEntityState> {
  const actor = await requireActor();
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = entityInput.safeParse(values);
  if (!parsed.success) return { error: "Điền đủ các trường bắt buộc", values };
  let entityId: string;
  try {
    ({ entityId } = await app().core.entities.createEntity(actor, parsed.data));
  } catch (err) {
    return { error: domainMessage(err), values };
  }
  revalidatePath(LIST);
  redirect(`${LIST}/${entityId}?moi=1`);
}

export interface ChangeEmailState {
  error?: string;
  saved?: boolean;
}

/** Story 12: a new email for the Người dùng đại diện, so the Chủ thể can recover its account. */
export async function changeRepresentativeEmailAction(entityId: string, _prev: ChangeEmailState, form: FormData): Promise<ChangeEmailState> {
  const actor = await requireActor();
  const email = z.string().trim().min(1).safeParse(form.get("email"));
  if (!email.success) return { error: "Nhập email mới" };
  try {
    await app().core.entities.changeRepresentativeEmail(actor, { entityId, email: email.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`${LIST}/${entityId}`);
  return { saved: true };
}
