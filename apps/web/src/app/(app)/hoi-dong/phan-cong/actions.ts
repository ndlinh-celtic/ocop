"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface AssignmentFormState {
  error?: string;
  saved?: number;
}

const input = z.object({
  // Each checked hồ sơ as "<id>:<version>", the version the page was rendered with.
  dossiers: z
    .array(z.string().regex(/^[\w-]+:\d+$/))
    .min(1)
    .max(500),
  members: z.array(z.string().min(1)).max(100),
  advisors: z.array(z.string().min(1)).max(100),
});

/** L09 HD-02 (stories 25 to 29): writes the same Phân công nháp on every checked hồ sơ. */
export async function editAssignmentsAction(_prev: AssignmentFormState, form: FormData): Promise<AssignmentFormState> {
  const actor = await requireActor();
  const parsed = input.safeParse({ dossiers: form.getAll("dossier"), members: form.getAll("member"), advisors: form.getAll("advisor") });
  if (!parsed.success) return { error: "Chọn ít nhất một hồ sơ để phân công" };
  const dossiers = parsed.data.dossiers.map((v) => {
    const [dossierId, version] = v.split(":");
    return { dossierId: dossierId!, expectedVersion: Number(version) };
  });
  try {
    await app().core.councils.editAssignments(actor, { dossiers, members: parsed.data.members, advisors: parsed.data.advisors });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/hoi-dong/phan-cong");
  return { saved: dossiers.length };
}
