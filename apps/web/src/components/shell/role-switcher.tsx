"use client";

import { Check, Repeat } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SwitchOption {
  id: string;
  roleLabel: string;
  scopeLabel: string;
  current: boolean;
}

/** Popover listing the Người dùng's active Phân vai; picking one submits the server action. */
export function RoleSwitcher({ options, action }: { options: SwitchOption[]; action: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  if (options.length < 2) return null;
  const current = options.find((o) => o.current);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm"
      >
        <Repeat className="size-4" aria-hidden />
        <span className="hidden max-w-40 truncate sm:inline">{current?.roleLabel ?? "Chọn vai trò"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-line bg-surface p-2 shadow-pop">
          <p className="px-2 pb-2 text-xs font-semibold text-text-2">Chuyển vai trò</p>
          {options.map((o) => (
            <form key={o.id} action={action.bind(null, o.id)}>
              <button type="submit" role="menuitem" className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left hover:bg-surface-2">
                <span className="flex-1">
                  <span className="block font-medium">{o.roleLabel}</span>
                  <span className="block text-xs text-text-2">{o.scopeLabel}</span>
                </span>
                {o.current && <Check className="size-4 text-brand" aria-label="Đang dùng" />}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
