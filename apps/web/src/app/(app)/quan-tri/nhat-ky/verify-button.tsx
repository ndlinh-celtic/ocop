"use client";

import type { ChainVerification } from "@ocop/core";
import { useState, useTransition } from "react";
import { verifyChainAction } from "./actions";

export function VerifyChainButton() {
  const [result, setResult] = useState<ChainVerification>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await verifyChainAction()))}
        className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand disabled:opacity-60"
      >
        {pending ? "Đang kiểm tra…" : "Kiểm tra toàn vẹn chuỗi"}
      </button>
      {result?.ok && (
        <span role="status" className="text-sm text-brand">
          Toàn vẹn: {result.checked} dòng đã niêm phong.
        </span>
      )}
      {result && !result.ok && (
        <span role="alert" className="text-sm text-danger">
          Chuỗi bị phá vỡ tại số {result.brokenAtSeq} ({result.reason}).
        </span>
      )}
    </div>
  );
}
