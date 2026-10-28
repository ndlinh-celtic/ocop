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
  "dossier.province_receive": "Sở tiếp nhận tại tỉnh",
  // L09 HD-06 (story 137): the milestone only; who is Phân công never shows here.
  "dossier.grading.start_advisory": "Hội đồng giao thẩm định",
  "dossier.grading.start_direct": "Hội đồng giao chấm",
  // L11 TM-07 (#56): the phát hành, without the Điểm đề xuất or the lý do of a phiên bản mới.
  "dossier.advisory_report.issue": "Tổ tư vấn phát hành báo cáo",
  "dossier.advisory_report.reissue": "Tổ tư vấn phát hành báo cáo phiên bản mới",
  // L15 HD-08 (story 137): chốt điểm, without the points.
  "dossier.finalize": "Hội đồng chốt điểm",
  // L16 HD-11 (#83, story 67): Công bố kết quả by a Quyết định công nhận.
  "dossier.recognize": "Công bố kết quả: được công nhận theo Quyết định công nhận",
  "dossier.result_publish": "Công bố kết quả: đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao",
  "dossier.round_transfer": "Chuyển đợt",
  // Steps of the bản làm việc, on the timeline only when a Cán bộ xã Nhập hộ them (story 74).
  "dossier.edit": "Sửa thông tin sản phẩm",
  "dossier.evidence.add": "Thêm tệp minh chứng",
  "dossier.evidence.remove": "Bỏ tệp minh chứng",
  "dossier.evidence.link": "Gắn minh chứng với tiêu chí",
  "dossier.self_score": "Tự chấm thử",
  "dossier.explain": "Viết giải trình",
  "dossier.supplement.respond": "Trả lời yêu cầu bổ sung",
};

const ON_BEHALF = "_on_behalf";

function describe(e: DossierEvent, names: ReadonlyMap<string, string>) {
  // L01 Nhập hộ (story 74): the step a Cán bộ xã took for the Chủ thể, said as such.
  const onBehalf = e.action.endsWith(ON_BEHALF);
  const action = onBehalf ? e.action.slice(0, -ON_BEHALF.length) : e.action;
  const label = (ACTION_LABEL[action] ?? action) + (onBehalf ? " (Cán bộ xã nhập hộ)" : "");
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
