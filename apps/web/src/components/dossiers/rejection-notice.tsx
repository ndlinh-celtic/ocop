import type { DossierRejection } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";

/** Story 35: why a hồ sơ is Không đạt sơ bộ, the Điều kiện loại cited or the Lý do loại sơ bộ, with its diễn giải. */
export function RejectionNotice({ rejection }: { rejection: DossierRejection }) {
  return (
    <section role="status" className="rounded-lg border border-danger bg-surface p-4 text-sm shadow-card">
      <h2 className="mb-2 font-semibold text-danger">Không đạt sơ bộ</h2>
      <p>
        {rejection.kind === "exclusion_condition" ? "Điều kiện loại của Bộ tiêu chí: " : "Lý do loại sơ bộ: "}
        <b>{rejection.text}</b>
      </p>
      {rejection.explanation && <p className="mt-1 whitespace-pre-line">Diễn giải: {rejection.explanation}</p>}
      <p className="mt-1 text-text-3">UBND xã/phường loại hồ sơ lúc {formatVnDateTime(rejection.rejectedAt)}.</p>
    </section>
  );
}
