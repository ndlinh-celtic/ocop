"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { revealPersonalIdAction } from "./actions";

/** Story 13: the masked số định danh cá nhân, shown in full on request (an audited access). */
export function RevealPersonalId({ entityId, masked }: { entityId: string; masked: string }) {
  const [full, setFull] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span data-testid="personal-id">{full ?? masked}</span>
      {!full && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-brand"
          onClick={async () => {
            const r = await revealPersonalIdAction(entityId);
            if (r.personalId) setFull(r.personalId);
            else setError(r.error);
          }}
        >
          <Eye className="size-3.5" aria-hidden />
          Hiện đầy đủ
        </button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
