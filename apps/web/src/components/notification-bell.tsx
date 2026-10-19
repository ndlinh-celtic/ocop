"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_MS = 60_000;

/** Unread count, refreshed every minute and when the tab regains focus (L23). */
export function NotificationBell({ initial }: { initial: number }) {
  const [unread, setUnread] = useState(initial);
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
    <Link href="/thong-bao" aria-label={`Thông báo, ${unread} chưa đọc`} className="relative rounded-lg border px-3 py-1" data-testid="notification-bell">
      Thông báo
      {unread > 0 && (
        <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-semibold text-white">{unread}</span>
      )}
    </Link>
  );
}
