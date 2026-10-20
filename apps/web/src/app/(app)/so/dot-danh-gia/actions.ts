"use server";

import { AGGREGATION_METHODS, GRADING_MODES, type RoundInput } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface RoundFormState {
  error?: string;
  saved?: boolean;
}

export interface RoundActionState {
  error?: string;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const roundForm = z.object({
  name: z.string().trim().min(1),
  year: z.coerce.number().int(),
  submissionDeadline: isoDate,
  forwardingDeadline: isoDate,
  evaluationDeadline: isoDate,
  criteriaVersionId: z.string().min(1),
  gradingMode: z.enum(GRADING_MODES),
  aggregationMethod: z.enum(AGGREGATION_METHODS),
  minGraders: z.coerce.number().int(),
  deviationFlagPoints: z.coerce.number(),
});

function parseRound(form: FormData): RoundInput | null {
  const fields = Object.keys(roundForm.shape).map((k) => [k, form.get(k) ?? undefined]);
  const parsed = roundForm.safeParse(Object.fromEntries(fields));
  if (!parsed.success) return null;
  const { aggregationMethod, minGraders, deviationFlagPoints, ...rest } = parsed.data;
  return { ...rest, aggregation: { method: aggregationMethod, minGraders, deviationFlagPoints } };
}

const INCOMPLETE = "Điền đủ tên, năm, ba mốc hạn, Phiên bản tiêu chí, Chế độ chấm và Quy tắc tổng hợp";

/** L07 SO-01: creates a Nháp Đợt đánh giá, then opens its page. */
export async function createRoundAction(_prev: RoundFormState, form: FormData): Promise<RoundFormState> {
  const actor = await requireActor();
  const input = parseRound(form);
  if (!input) return { error: INCOMPLETE };
  let roundId: string;
  try {
    ({ roundId } = await app().core.rounds.createRound(actor, input));
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/dot-danh-gia");
  redirect(`/so/dot-danh-gia/${roundId}`);
}

/** L07 SO-01: edits a Nháp round. */
export async function updateRoundAction(roundId: string, _prev: RoundFormState, form: FormData): Promise<RoundFormState> {
  const actor = await requireActor();
  const input = parseRound(form);
  if (!input) return { error: INCOMPLETE };
  try {
    await app().core.rounds.updateRound(actor, { roundId, ...input });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/dot-danh-gia");
  revalidatePath(`/so/dot-danh-gia/${roundId}`);
  return { saved: true };
}

/** L07 SO-01: Nháp → Đang nhận nộp. */
export async function openRoundAction(roundId: string, _prev: RoundActionState, _form: FormData): Promise<RoundActionState> {
  const actor = await requireActor();
  try {
    await app().core.rounds.openRound(actor, { roundId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/dot-danh-gia");
  revalidatePath(`/so/dot-danh-gia/${roundId}`);
  return {};
}

/** L07 SO-01: deletes a Nháp round created by mistake. */
export async function deleteRoundAction(roundId: string, _prev: RoundActionState, _form: FormData): Promise<RoundActionState> {
  const actor = await requireActor();
  try {
    await app().core.rounds.deleteRound(actor, { roundId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/dot-danh-gia");
  redirect("/so/dot-danh-gia");
}
