"use server";

import { CriteriaImportError, type ImportIssue } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ImportState {
  error?: string;
  issues?: ImportIssue[];
  versionId?: string;
}

/** L19 AD-03: imports a file in the QĐ 26 extraction format as a draft Phiên bản tiêu chí. */
export async function importVersionAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const actor = await requireActor();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chọn tệp JSON theo định dạng bóc tách QĐ 26" };
  try {
    const { versionId } = await app().core.criteria.importVersion(actor, { fileName: file.name, content: await file.text() });
    revalidatePath("/quan-tri/bo-tieu-chi");
    return { versionId };
  } catch (err) {
    if (err instanceof CriteriaImportError) return { error: "Tệp không đúng định dạng, chưa có gì được tạo.", issues: err.issues.slice(0, 50) };
    return { error: domainMessage(err) };
  }
}
