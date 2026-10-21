"use client";

import { useState } from "react";
import { LegalDocumentForm } from "./legal-document-form";

/** Story 8: opens the form that replaces this giấy tờ with a newer one of the same Loại. */
export function ReplaceDocument({ entityId, document }: { entityId: string; document: { id: string; typeCode: string; typeName: string } }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border px-3 py-1 text-sm">
        Thay thế
      </button>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-line-strong bg-surface-2 p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Thay {document.typeName.toLowerCase()}; giấy tờ cũ được giữ trong lịch sử.</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-text-2">
          Hủy
        </button>
      </div>
      <LegalDocumentForm entityId={entityId} types={[]} replaces={document} onDone={() => setOpen(false)} />
    </div>
  );
}
