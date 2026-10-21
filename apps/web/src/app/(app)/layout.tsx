import { ROLE_LABEL } from "@ocop/core";
import { LogOut } from "lucide-react";
import { FlashProvider } from "@/components/flash";
import { NotificationBell } from "@/components/notification-bell";
import { AppShell } from "@/components/shell/app-shell";
import { RoleSwitcher } from "@/components/shell/role-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { signOutAction, switchRoleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const [unread, mine] = await Promise.all([app().core.notifications.unreadCount(actor), app().core.identity.myAssignments(actor)]);
  const current = mine.find((a) => a.current);
  return (
    <AppShell
      role={actor.activeRole}
      roleLabel={actor.activeRole ? ROLE_LABEL[actor.activeRole] : "Cá nhân"}
      scopeLabel={current ? `${current.roleLabel} · ${current.scopeLabel}` : null}
      userName={actor.fullName}
      unread={unread}
      topbarRight={
        <>
          <RoleSwitcher options={mine} action={switchRoleAction} />
          <NotificationBell initial={unread} />
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" aria-label="Đăng xuất" className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm">
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </form>
        </>
      }
    >
      <FlashProvider>{children}</FlashProvider>
    </AppShell>
  );
}
