"use server";

import { AGGREGATION_METHODS, GRADING_MODES, type RoundInput } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formInteger, formNumber } from "@/lib/form-fields";
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
  year: formInteger(),
  submissionDeadline: isoDate,
  forwardingDeadline: isoDate,
  evaluationDeadline: isoDate,
  criteriaVersionId: z.string().min(1),
  gradingMode: z.enum(GRADING_MODES),
  aggregationMethod: z.enum(AGGREGATION_METHODS),
  minGraders: formInteger(),
  deviationFlagPoints: formNumber(),
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

const gradingModeForm = z.object({ gradingMode: z.enum(GRADING_MODES) });
const aggregationForm = roundForm.pick({ aggregationMethod: true, minGraders: true, deviationFlagPoints: true });

function revalidateRound(roundId: string) {
  revalidatePath("/so/dot-danh-gia");
  revalidatePath(`/so/dot-danh-gia/${roundId}`);
}

/** L07 HD-06: changes the Chế độ chấm of an opened round until its first phiếu chấm. */
export async function changeGradingModeAction(roundId: string, _prev: RoundFormState, form: FormData): Promise<RoundFormState> {
  const actor = await requireActor();
  const parsed = gradingModeForm.safeParse({ gradingMode: form.get("gradingMode") });
  if (!parsed.success) return { error: "Chọn Chế độ chấm" };
  try {
    await app().core.rounds.changeGradingMode(actor, { roundId, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidateRound(roundId);
  return { saved: true };
}

/** L07 HD-06: changes the Quy tắc tổng hợp of an opened round until its first phiếu chấm. */
export async function changeAggregationRuleAction(roundId: string, _prev: RoundFormState, form: FormData): Promise<RoundFormState> {
  const actor = await requireActor();
  const parsed = aggregationForm.safeParse({
    aggregationMethod: form.get("aggregationMethod"),
    minGraders: form.get("minGraders"),
    deviationFlagPoints: form.get("deviationFlagPoints"),
  });
  if (!parsed.success) return { error: "Điền đủ Quy tắc tổng hợp" };
  const { aggregationMethod: method, minGraders, deviationFlagPoints } = parsed.data;
  try {
    await app().core.rounds.changeAggregationRule(actor, { roundId, aggregation: { method, minGraders, deviationFlagPoints } });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidateRound(roundId);
  return { saved: true };
}

/** L07 SO-01: Đã đóng nộp → Đã kết thúc, once every hồ sơ has a result. */
export async function endRoundAction(roundId: string, _prev: RoundActionState, _form: FormData): Promise<RoundActionState> {
  const actor = await requireActor();
  try {
    await app().core.rounds.endRound(actor, { roundId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidateRound(roundId);
  return {};
}
