"use server";

import { redirect } from "next/navigation";
import { app } from "@/server/app";
import { clearSessionCookie, currentActor, requireActor } from "@/server/session";

export async function signOutAction() {
  const actor = await currentActor();
  if (actor) await app().core.identity.signOut(actor);
  await clearSessionCookie();
  redirect("/dang-nhap");
}

export async function switchRoleAction(assignmentId: string) {
  await app().core.identity.switchActiveRole(await requireActor(), assignmentId);
  redirect("/");
}
