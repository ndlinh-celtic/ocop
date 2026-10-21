"use client";

import { useState } from "react";

/** Asks the server for a short-lived link to a clean file, then follows it. */
export function DownloadButton({ fileId, download, label = "Tải xuống" }: { fileId: string; download: (fileId: string) => Promise<{ url?: string; error?: string }>; label?: string }) {
  const [error, setError] = useState<string>();
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border px-3 py-1 text-sm"
        onClick={async () => {
          const r = await download(fileId);
          if (r.url) window.location.href = r.url;
          else setError(r.error);
        }}
      >
        {label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
