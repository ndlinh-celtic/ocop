"use server";

import { MAX_GENERAL_COMMENT } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface GeneralCommentFormState {
  error?: string;
  saved?: boolean;
}

const text = z.string().max(MAX_GENERAL_COMMENT);

/** L16 CT-13, HD-10 (#80, stories 1 to 4): the Nhận xét chung of a hồ sơ Đã chốt điểm, at the version the page showed. */
export async function editGeneralCommentAction(
  dossierId: string,
  expectedVersion: number,
  _prev: GeneralCommentFormState,
  form: FormData,
): Promise<GeneralCommentFormState> {
  const actor = await requireActor();
  const parsed = text.safeParse(form.get("text") ?? "");
  if (!parsed.success) return { error: `Nhận xét chung tối đa ${MAX_GENERAL_COMMENT.toLocaleString("vi-VN")} ký tự` };
  try {
    await app().core.results.editGeneralComment(actor, { dossierId, expectedVersion, text: parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/chot-diem/${dossierId}`);
  return { saved: true };
}
