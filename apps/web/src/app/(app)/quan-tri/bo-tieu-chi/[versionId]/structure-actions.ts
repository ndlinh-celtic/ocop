"use server";

import type { DraftNodeKind, MoveDirection, NodeAddition } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import type { EditOutcome } from "./edit-actions";

/*
 * L19 AD-03: add, remove and reorder the nodes of a draft Phiên bản tiêu chí (#23). The core checks every
 * argument against its own schema, so they are passed through as received.
 */

const versionIdOf = (versionId: string) => z.string().min(1).parse(versionId);

async function run(change: () => Promise<{ issues: unknown[] }>): Promise<EditOutcome> {
  try {
    const { issues } = await change();
    // The draft page, its Bộ tiêu chí pages and the list (number of Bộ tiêu chí) all show the change.
    revalidatePath("/quan-tri/bo-tieu-chi", "layout");
    return { ok: true, issueCount: issues.length };
  } catch (err) {
    return { ok: false, error: domainMessage(err) };
  }
}

export async function addNodeAction(versionId: string, addition: NodeAddition): Promise<EditOutcome> {
  const actor = await requireActor();
  return run(() => app().core.criteria.addNode(actor, { versionId: versionIdOf(versionId), addition }));
}

export async function removeNodeAction(versionId: string, node: DraftNodeKind, id: string): Promise<EditOutcome> {
  const actor = await requireActor();
  return run(() => app().core.criteria.removeNode(actor, { versionId: versionIdOf(versionId), node, id }));
}

export async function moveNodeAction(versionId: string, node: DraftNodeKind, id: string, direction: MoveDirection): Promise<EditOutcome> {
  const actor = await requireActor();
  return run(() => app().core.criteria.moveNode(actor, { versionId: versionIdOf(versionId), node, id, direction }));
}
