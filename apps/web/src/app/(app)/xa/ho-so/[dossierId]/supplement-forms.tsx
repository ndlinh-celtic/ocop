"use client";

import { FilePlus2, Plus, Trash2, XCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { closeUnsupplementedAction, requestSupplementAction, type WardDossierFormState } from "../actions";

interface Row {
  key: number;
  content: string;
  /** "" for none, "c:<criterionId>" or "d:<legal document type code>". */
  target: string;
}

const fieldClass = "rounded-lg border border-line-strong bg-surface px-3 py-2";

/**
 * L04 XA-05 (story 50): the nội dung to ask for, each optionally tied to a Tiêu chí of the hồ sơ or a loại
 * giấy tờ, and the hạn bổ sung as a day (it runs to 23:59:59 giờ Việt Nam).
 */
export function RequestSupplementForm({
  dossierId,
  version,
  today,
  criteria,
  documentTypes,
}: {
  dossierId: string;
  version: number;
  /** YYYY-MM-DD in giờ Việt Nam, the earliest hạn bổ sung. */
  today: string;
  criteria: { id: string; label: string }[];
  documentTypes: { code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(requestSupplementAction.bind(null, dossierId, version), {});
  const [rows, setRows] = useState<Row[]>([{ key: 0, content: "", target: "" }]);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const items = rows
    .filter((r) => r.content.trim() !== "")
    .map((r) => ({
      content: r.content,
      ...(r.target.startsWith("c:") ? { criterionId: r.target.slice(2) } : {}),
      ...(r.target.startsWith("d:") ? { legalDocumentTypeCode: r.target.slice(2) } : {}),
    }));

  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Yêu cầu bổ sung</h2>
      <p className="mb-3 text-sm text-text-2">Chủ thể được thông báo, sửa hồ sơ, trả lời từng nội dung và nộp lại trước hạn bổ sung.</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <ol className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <label className="flex flex-col gap-1 text-sm">
                Nội dung {i + 1}
                <textarea value={r.content} onChange={(e) => update(r.key, { content: e.target.value })} maxLength={2000} rows={2} className={fieldClass} />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-sm">
                  Gắn với
                  <select value={r.target} onChange={(e) => update(r.key, { target: e.target.value })} className={`${fieldClass} max-w-sm`}>
                    <option value="">Không gắn</option>
                    <optgroup label="Tiêu chí">
                      {criteria.map((c) => (
                        <option key={c.id} value={`c:${c.id}`}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Giấy tờ pháp lý">
                      {documentTypes.map((d) => (
                        <option key={d.code} value={`d:${d.code}`}>
                          {d.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden /> Bỏ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((x) => x.key)) + 1, content: "", target: "" }])}
          className="flex w-fit items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm"
        >
          <Plus className="size-4" aria-hidden /> Thêm nội dung
        </button>
        <label className="flex flex-col gap-1 text-sm">
          Hạn bổ sung (đến 23:59 ngày này)
          <input type="date" name="deadline" required min={today} className={`${fieldClass} w-fit`} />
        </label>
        <button
          type="submit"
          disabled={pending || items.length === 0}
          className="flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
        >
          <FilePlus2 className="size-4" aria-hidden /> Gửi yêu cầu bổ sung
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}

/** L04 XA-05 (story 56): offered once the hạn bổ sung has passed without a nộp lại. */
export function CloseUnsupplementedForm({ dossierId, version }: { dossierId: string; version: number }) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(closeUnsupplementedAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Quá hạn bổ sung</h2>
      <p className="mb-3 text-sm text-text-2">Chủ thể chưa nộp lại trước hạn. Có thể đóng hồ sơ về Không đạt sơ bộ với lý do &quot;Không bổ sung&quot;.</p>
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm("Đóng hồ sơ về Không đạt sơ bộ với lý do Không bổ sung?")) e.preventDefault();
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
        >
          <XCircle className="size-4" aria-hidden /> Đóng hồ sơ: Không bổ sung
        </button>
        {state.error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
