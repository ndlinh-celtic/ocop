"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface MeetingFormState {
  error?: string;
  saved?: boolean;
}

const createInput = z.object({
  roundId: z.string().min(1, "Chọn đợt"),
  title: z.string().trim().min(1, "Nhập tiêu đề Phiên họp").max(500),
  heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày họp"),
  location: z.string().trim().min(1, "Nhập địa điểm họp").max(500),
  dossierIds: z.array(z.string().min(1)).max(500),
});

/** L15 HD-09 (story 107): lập a Phiên họp, with the checked hồ sơ Sẵn sàng chốt, then open it. */
export async function createMeetingAction(_prev: MeetingFormState, form: FormData): Promise<MeetingFormState> {
  const actor = await requireActor();
  const parsed = createInput.safeParse({
    roundId: form.get("roundId"),
    title: form.get("title"),
    heldOn: form.get("heldOn"),
    location: form.get("location"),
    dossierIds: form.getAll("dossier"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin Phiên họp chưa hợp lệ" };
  let meetingId: string;
  try {
    ({ meetingId } = await app().core.scoring.createMeeting(actor, parsed.data));
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/hoi-dong/van-ban", "layout");
  redirect(`/hoi-dong/van-ban/${meetingId}`);
}

/** Story 108: adds the checked hồ sơ Sẵn sàng chốt to an open Phiên họp. */
export async function addMeetingDossiersAction(meetingId: string, _prev: MeetingFormState, form: FormData): Promise<MeetingFormState> {
  const actor = await requireActor();
  const parsed = z.array(z.string().min(1)).min(1).max(500).safeParse(form.getAll("dossier"));
  if (!parsed.success) return { error: "Chọn ít nhất một hồ sơ" };
  try {
    await app().core.scoring.addMeetingDossiers(actor, { meetingId, dossierIds: parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/van-ban/${meetingId}`);
  return { saved: true };
}

/** Story 108: gỡ a hồ sơ not yet chốt from an open Phiên họp. */
export async function removeMeetingDossierAction(meetingId: string, dossierId: string, _prev: MeetingFormState, _form: FormData): Promise<MeetingFormState> {
  const actor = await requireActor();
  try {
    await app().core.scoring.removeMeetingDossier(actor, { meetingId, dossierId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/van-ban/${meetingId}`);
  return { saved: true };
}

/** Kết thúc a Phiên họp once each of its hồ sơ is chốt or gỡ. */
export async function closeMeetingAction(meetingId: string, _prev: MeetingFormState, _form: FormData): Promise<MeetingFormState> {
  const actor = await requireActor();
  try {
    await app().core.scoring.closeMeeting(actor, { meetingId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/hoi-dong/van-ban", "layout");
  return { saved: true };
}
