"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";

const DossierVersion = createContext<RefObject<number> | null>(null);

/**
 * The version of the hồ sơ last seen by any editor of the page (thông tin sản phẩm, kho minh chứng, tự
 * chấm thử). They share it so that a write by one does not make the next write of another stale before
 * the page has reloaded its data; it follows the server's version once that arrives.
 */
export function DossierVersionProvider({ version, children }: { version: number; children: ReactNode }) {
  const latest = useRef(version);
  useEffect(() => {
    latest.current = Math.max(latest.current, version);
  }, [version]);
  return <DossierVersion.Provider value={latest}>{children}</DossierVersion.Provider>;
}

export function useDossierVersion() {
  const ref = useContext(DossierVersion);
  if (!ref) throw new Error("useDossierVersion needs a DossierVersionProvider");
  return ref;
}
