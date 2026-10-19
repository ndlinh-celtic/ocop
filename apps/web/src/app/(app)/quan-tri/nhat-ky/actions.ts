"use server";

import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export async function verifyChainAction() {
  return app().core.audit.verifyAsAdmin(await requireActor());
}
