"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const PAGE = "/so/hoi-dong";
const fileInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });

/** Step one of a quyết định thành lập: a pre-signed upload, quarantined until scanned. */
export async function requestDecisionUploadAction(
  input: z.infer<typeof fileInput>,
): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  try {
    return await app().core.files.requestUpload(actor, { ...fileInput.parse(input), purpose: "council_decision" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

export async function completeDecisionUploadAction(fileId: string, parts?: { partNumber: number; etag: string }[]): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return {};
}

const councilInput = z.object({
  name: z.string().trim().min(1),
  decisionNumber: z.string().trim().min(1),
  decisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  decisionFileId: z.string().min(1),
});
const INCOMPLETE = "Điền đủ tên hội đồng, số và ngày quyết định, và chọn tệp quyết định";

/** L09 HD-01 story 1: records a Hội đồng once its quyết định is uploaded. */
export async function createCouncilAction(input: z.infer<typeof councilInput>): Promise<{ councilId?: string; error?: string }> {
  const actor = await requireActor();
  const parsed = councilInput.safeParse(input);
  if (!parsed.success) return { error: INCOMPLETE };
  try {
    const { councilId } = await app().core.councils.create(actor, parsed.data);
    revalidatePath(PAGE);
    return { councilId };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** L09 HD-01 story 4: corrects a Hội đồng; the recorded quyết định stays unless a new one was uploaded. */
export async function updateCouncilAction(councilId: string, input: z.infer<typeof councilInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = councilInput.safeParse(input);
  if (!parsed.success) return { error: INCOMPLETE };
  try {
    await app().core.councils.update(actor, { councilId, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(PAGE);
  revalidatePath(`${PAGE}/${councilId}`);
  return {};
}

export interface LeaderState {
  error?: string;
  saved?: boolean;
}

/** L09 HD-01 stories 2, 3: names or changes the Tổ trưởng. */
export async function setLeaderAction(councilId: string, _prev: LeaderState, form: FormData): Promise<LeaderState> {
  const actor = await requireActor();
  const userId = String(form.get("userId") ?? "");
  if (!userId) return { error: "Chọn Tổ trưởng" };
  try {
    await app().core.councils.setLeader(actor, { councilId, userId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`${PAGE}/${councilId}`);
  return { saved: true };
}

/** A short-lived link to the quyết định thành lập; `councilId` is passed where DownloadButton passes a file id. */
export async function downloadDecisionAction(councilId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    return { url: (await app().core.councils.downloadDecision(actor, { councilId })).url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
