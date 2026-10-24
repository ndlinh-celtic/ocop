"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";

const FlashContext = createContext<(text: string) => void>(() => {});

/**
 * A success message that outlives the form that sent it: after Tiếp nhận tại tỉnh or the Giao chấm of the last hồ
 * sơ, the page re-renders without the form, so the form cannot show it. Held by the (app) layout, shown above the
 * page it was set on, gone on navigating away or when closed.
 */
export function FlashProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [flash, setFlash] = useState<{ text: string; path: string } | null>(null);
  const show = useCallback((text: string) => setFlash({ text, path: pathname }), [pathname]);
  const shown = flash && flash.path === pathname ? flash.text : null;
  return (
    <FlashContext.Provider value={show}>
      {shown && (
        <p role="status" data-testid="flash" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-brand bg-brand-soft px-4 py-2 text-sm text-brand">
          {shown}
          <button type="button" onClick={() => setFlash(null)} aria-label="Đóng thông báo">
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}
      {children}
    </FlashContext.Provider>
  );
}

/** Sets the flash message; call it inside the action, so it commits with the page that no longer has the form. */
export const useFlash = () => useContext(FlashContext);
