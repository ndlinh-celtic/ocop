import { DOSSIER_STATE_LABEL, type DossierEvent } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  "dossier.create": "Tạo hồ sơ",
  "dossier.delete": "Xóa hồ sơ",
  "dossier.submit": "Nộp hồ sơ",
  "dossier.withdraw": "Rút hồ sơ",
  "dossier.receive": "Xã tiếp nhận hồ sơ",
  "dossier.handler.change": "Đổi Cán bộ phụ trách",
  "dossier.supplement.request": "Xã yêu cầu bổ sung",
  "dossier.resubmit": "Nộp lại hồ sơ",
  "dossier.supplement.close": "Đóng hồ sơ quá hạn bổ sung",
  "dossier.reject": "Xã loại hồ sơ",
  "dossier.ward_transfer": "Chuyển xã",
  "dossier.forward": "Xã gửi tỉnh",
  "dossier.province_return": "Sở trả về để bổ sung",
};

function describe(e: DossierEvent, names: ReadonlyMap<string, string>) {
  const label = ACTION_LABEL[e.action] ?? e.action;
  let text = e.fromState && e.fromState !== e.toState ? `${label}: ${DOSSIER_STATE_LABEL[e.fromState]} → ${DOSSIER_STATE_LABEL[e.toState]}` : label;
  const handler = typeof e.metadata.handlerUserId === "string" ? names.get(e.metadata.handlerUserId) : undefined;
  if (handler) text += `. Cán bộ phụ trách: ${handler}`;
  return e.reason ? `${text}. Lý do: ${e.reason}` : text;
}

/** Story 34: the dòng thời gian of a hồ sơ, oldest first. `names` gives the Cán bộ phụ trách by id when the reader may see them. */
export function DossierTimeline({ events, names = new Map() }: { events: DossierEvent[]; names?: ReadonlyMap<string, string> }) {
  return (
    <section className="rounded-lg border bg-surface shadow-card">
      <h2 className="border-b p-4 font-semibold">Dòng thời gian</h2>
      <ol className="divide-y">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
            <span>{describe(e, names)}</span>
            <span className="text-text-3">{formatVnDateTime(e.occurredAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
