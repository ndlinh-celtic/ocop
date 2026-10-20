"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_MS = 60_000;

/** Unread count, refreshed every minute and when the tab regains focus (L23). */
export function NotificationBell({ initial }: { initial: number }) {
  const [unread, setUnread] = useState(initial);
  useEffect(() => setUnread(initial), [initial]);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const res = await fetch("/api/notifications/unread", { cache: "no-store" }).catch(() => null);
      if (alive && res?.ok) setUnread(((await res.json()) as { unread: number }).unread);
    };
    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return (
    <Link
      href="/thong-bao"
      aria-label={`Thông báo, ${unread} chưa đọc`}
      className="relative rounded-md border border-line p-1.5 text-text-2"
      data-testid="notification-bell"
    >
      <Bell className="size-4" aria-hidden />
      {unread > 0 && (
        <span data-testid="unread-count" className="absolute -right-2 -top-2 min-w-5 rounded-full bg-danger px-1.5 text-center text-xs font-semibold text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}
