import { ROLE_LABEL } from "@ocop/core";
import { NotificationBell } from "@/components/notification-bell";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const unread = await app().core.notifications.unreadCount(actor);
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">OCOP</span>
        <div className="flex items-center gap-3 text-sm">
          <NotificationBell initial={unread} />
          <span>
            {actor.fullName}
            {actor.activeRole && <span className="text-gray-500"> · {ROLE_LABEL[actor.activeRole]}</span>}
          </span>
          <form action={signOutAction}>
            <button type="submit" className="rounded-lg border px-3 py-1">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
