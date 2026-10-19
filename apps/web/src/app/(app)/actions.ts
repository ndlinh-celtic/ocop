"use server";

import { redirect } from "next/navigation";
import { app } from "@/server/app";
import { clearSessionCookie, currentActor } from "@/server/session";

export async function signOutAction() {
  const actor = await currentActor();
  if (actor) await app().core.identity.signOut(actor);
  await clearSessionCookie();
  redirect("/dang-nhap");
}
