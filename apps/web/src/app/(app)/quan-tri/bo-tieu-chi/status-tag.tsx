import type { VersionStatus } from "@ocop/core";

/** Trạng thái of a Phiên bản tiêu chí. */
export function StatusTag({ status }: { status: VersionStatus }) {
  return status === "published" ? (
    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">Đã phát hành</span>
  ) : (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2 ring-1 ring-line-strong">Nháp</span>
  );
}

/** A calendar date stored as YYYY-MM-DD, shown as DD/MM/YYYY. */
export const formatIsoDate = (d: string) => d.split("-").reverse().join("/");
