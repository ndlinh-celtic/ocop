"use server";

import { revalidatePath } from "next/cache";
import { GRADING_MODES } from "@ocop/core";
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

export interface StartGradingFormState {
  error?: string;
  started?: number;
}

/** L09 HD-06 (stories 30 to 33): Giao chấm every checked hồ sơ, or none of them. */
export async function startGradingAction(_prev: StartGradingFormState, form: FormData): Promise<StartGradingFormState> {
  const actor = await requireActor();
  const parsed = input.shape.dossiers.safeParse(form.getAll("dossier"));
  if (!parsed.success) return { error: "Chọn ít nhất một hồ sơ để Giao chấm" };
  const dossiers = parsed.data.map((v) => {
    const [dossierId, version] = v.split(":");
    return { dossierId: dossierId!, expectedVersion: Number(version) };
  });
  try {
    await app().core.councils.startGrading(actor, { dossiers });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/hoi-dong/phan-cong");
  return { started: dossiers.length };
}

export interface GradingModeFormState {
  error?: string;
  saved?: boolean;
}

const gradingMode = z.object({ roundId: z.string().min(1), gradingMode: z.enum(GRADING_MODES) });

/** L09 HD-06 (stories 20, 21): the Thư ký confirms or changes the Chế độ chấm of a đợt of its Hội đồng. */
export async function changeGradingModeAction(_prev: GradingModeFormState, form: FormData): Promise<GradingModeFormState> {
  const actor = await requireActor();
  const parsed = gradingMode.safeParse({ roundId: form.get("roundId"), gradingMode: form.get("gradingMode") });
  if (!parsed.success) return { error: "Chọn Chế độ chấm" };
  try {
    await app().core.rounds.changeGradingMode(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/hoi-dong/phan-cong");
  return { saved: true };
}
