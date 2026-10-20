import { currentActor } from "@/server/session";
import { app } from "@/server/app";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await currentActor();
  if (!actor) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json({ unread: await app().core.notifications.unreadCount(actor) });
}
