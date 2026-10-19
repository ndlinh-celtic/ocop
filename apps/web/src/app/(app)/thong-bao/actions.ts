"use server";

import { revalidatePath } from "next/cache";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export async function markReadAction(id: string) {
  await app().core.notifications.markRead(await requireActor(), id);
  revalidatePath("/", "layout");
}

export async function markAllReadAction() {
  await app().core.notifications.markAllRead(await requireActor());
  revalidatePath("/", "layout");
}
