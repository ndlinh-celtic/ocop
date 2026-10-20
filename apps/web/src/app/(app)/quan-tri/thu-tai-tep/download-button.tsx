"use client";

import { useState } from "react";
import { downloadAction } from "./actions";

export function DownloadButton({ fileId }: { fileId: string }) {
  const [error, setError] = useState<string>();
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border px-3 py-1 text-sm"
        onClick={async () => {
          const r = await downloadAction(fileId);
          if (r.url) window.location.href = r.url;
          else setError(r.error);
        }}
      >
        Tải xuống
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
