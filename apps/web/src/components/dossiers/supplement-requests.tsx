import type { SupplementRequestView } from "@ocop/core";
import type { ReactNode } from "react";
import { formatVnDateTime } from "@/lib/format";

type Item = SupplementRequestView["items"][number];

const OUTCOME_LABEL = { resubmitted: "Đã nộp lại", closed_unsupplemented: "Đã đóng, không bổ sung" } as const;

function targetOf(item: Item) {
  if (item.criterion) return `Tiêu chí ${item.criterion.code} ${item.criterion.name}`;
  if (item.legalDocumentTypeName) return `Giấy tờ: ${item.legalDocumentTypeName}`;
  return null;
}

/**
 * L04 CT-11, XA-05 (stories 50, 51): the yêu cầu bổ sung of a hồ sơ, newest first, each nội dung with
 * what it is tied to and the Chủ thể's answer. `answer` renders the answer form of a nội dung of the open
 * request when the reader may answer it.
 */
export function SupplementRequests({ requests, answer }: { requests: SupplementRequestView[]; answer?: (item: Item) => ReactNode }) {
  if (requests.length === 0) return null;
  return (
    <section className="rounded-lg border bg-surface shadow-card">
      <h2 className="border-b p-4 font-semibold">Yêu cầu bổ sung</h2>
      <ol className="divide-y">
        {[...requests].reverse().map((r) => (
          <li key={r.id} className="flex flex-col gap-3 p-4 text-sm">
            <p className={r.closedAt ? "text-text-3" : "font-medium"}>
              Yêu cầu lúc {formatVnDateTime(r.requestedAt)} · Hạn bổ sung đến <b>{formatVnDateTime(r.deadline)}</b>
              {r.outcome && ` · ${OUTCOME_LABEL[r.outcome]}`}
            </p>
            <ol className="flex flex-col gap-3">
              {r.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-line p-3">
                  <p className="whitespace-pre-line">
                    <b>{item.position}.</b> {item.content}
                  </p>
                  {targetOf(item) && <p className="text-text-3">{targetOf(item)}</p>}
                  {!r.closedAt && answer ? (
                    answer(item)
                  ) : (
                    <p className="mt-1 whitespace-pre-line text-text-2">
                      Trả lời: {item.response || <span className="text-text-3">chưa trả lời</span>}
                      {item.respondedAt && <span className="text-text-3"> ({formatVnDateTime(item.respondedAt)})</span>}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}
