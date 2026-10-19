"use client";

import type { Role } from "@ocop/core";
import { ChevronLeft, Menu, Sprout, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { matchNav, navFor } from "@/lib/nav";

const COLLAPSE_KEY = "ocop.sidebar.collapsed";

interface Props {
  role: Role | null;
  roleLabel: string;
  scopeLabel: string | null;
  userName: string;
  unread: number;
  topbarRight: ReactNode;
  children: ReactNode;
}

/** Dark collapsible sidebar, breadcrumb and content area (prototype layout); a drawer on phones. */
export function AppShell({ role, roleLabel, scopeLabel, userName, unread, topbarRight, children }: Props) {
  const pathname = usePathname();
  const items = navFor(role);
  const current = matchNav(items, pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable: keep expanded */
    }
  }, []);
  useEffect(() => setDrawer(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const nav = (compact: boolean) => (
    <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 pb-4">
      {!compact && <div className="px-3 pb-2 pt-4 text-[11px] uppercase tracking-wider text-[#6F8E7A]">{roleLabel}</div>}
      {items.map((item) => {
        const active = item === current;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={compact ? item.label : undefined}
            className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
              active ? "bg-side-2 font-semibold text-white" : "text-side-text hover:bg-side-2 hover:text-white"
            } ${compact ? "justify-center px-0" : ""}`}
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-sm ${active ? "bg-brand text-white" : ""}`}>
              <Icon className="size-5" aria-hidden />
            </span>
            {!compact && <span className="flex-1 truncate">{item.label}</span>}
            {!compact && item.href === "/thong-bao" && unread > 0 && (
              <span className="rounded-full bg-amber px-2 text-xs font-semibold text-side">{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (compact: boolean) => (
    <div className={`flex items-center gap-3 px-5 pb-4 pt-6 ${compact ? "justify-center px-0" : ""}`}>
      <span className="grid size-9 place-items-center rounded-sm bg-brand text-white">
        <Sprout className="size-5" aria-hidden />
      </span>
      {!compact && <span className="text-lg font-bold text-white">OCOP</span>}
    </div>
  );

  const footer = (compact: boolean) =>
    !compact && (
      <div className="border-t border-side-2 p-4 text-sm">
        <p className="truncate font-medium text-white">{userName}</p>
        <p className="truncate text-side-text">{scopeLabel ?? "Chưa chọn vai trò"}</p>
      </div>
    );

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`relative hidden shrink-0 flex-col bg-side transition-[width] duration-200 md:flex ${collapsed ? "w-[84px]" : "w-[272px]"}`}
        data-testid="sidebar"
      >
        {brand(collapsed)}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          className="absolute -right-3 top-8 grid size-6 place-items-center rounded-full border border-line bg-surface text-text-2 shadow-card"
        >
          <ChevronLeft className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {nav(collapsed)}
        {footer(collapsed)}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[290px] max-w-[85vw] flex-col bg-side">
            <button type="button" aria-label="Đóng menu" onClick={() => setDrawer(false)} className="absolute right-3 top-6 text-side-text">
              <X className="size-5" aria-hidden />
            </button>
            {brand(false)}
            {nav(false)}
            {footer(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:px-6">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Mở menu" className="rounded-sm p-1 text-text-2 md:hidden">
            <Menu className="size-6" aria-hidden />
          </button>
          <nav aria-label="Vết điều hướng" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-text-2">
            <Link href="/" className="hidden sm:inline">
              Trang chủ
            </Link>
            {current && current.href !== "/" && (
              <>
                <span className="hidden text-text-3 sm:inline">/</span>
                <b className="truncate font-semibold text-text">{current.label}</b>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2">{topbarRight}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
