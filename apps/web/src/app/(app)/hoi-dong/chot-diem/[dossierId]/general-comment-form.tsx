"use client";

import { MessageSquareText } from "lucide-react";
import { useActionState } from "react";
import { editGeneralCommentAction, type GeneralCommentFormState } from "./general-comment-actions";

const MAX = 4000;

/**
 * L16 CT-13, HD-10 (#80, stories 1 to 4, 8): the Nhận xét chung of the Hội đồng, written by the Chủ tịch or Thư ký after
 * chốt and until Công bố kết quả; it prints in the dự thảo biên bản and dự thảo quyết định, and the Chủ thể sees it once
 * the kết quả is công bố. Read-only once công bố.
 */
export function GeneralCommentForm({
  dossierId,
  version,
  text,
  updated,
  locked,
}: {
  dossierId: string;
  version: number;
  text: string;
  /** When it was last written, formatted; null before. */
  updated: string | null;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState<GeneralCommentFormState, FormData>(editGeneralCommentAction.bind(null, dossierId, version), {});
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card" data-testid="general-comment">
      <h2 className="flex items-center gap-2 font-semibold">
        <MessageSquareText className="size-4" aria-hidden /> Nhận xét chung của Hội đồng
      </h2>
      {locked ? (
        <>
          <p className="whitespace-pre-line">{text || "Không có nhận xét chung."}</p>
          <p className="text-text-3">Kết quả đã công bố, nhận xét chung không sửa được nữa.</p>
        </>
      ) : (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-text-2">
            Chủ thể thấy nhận xét này khi kết quả được công bố. Nhận xét in vào dự thảo biên bản và dự thảo quyết định khi sinh lại văn bản họp.
          </p>
          <label className="sr-only" htmlFor="general-comment-text">
            Nhận xét chung
          </label>
          <textarea id="general-comment-text" name="text" defaultValue={text} maxLength={MAX} rows={5} className="rounded-md border bg-surface px-3 py-2" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
              Lưu nhận xét chung
            </button>
            {updated && <span className="text-text-3">Cập nhật lần cuối lúc {updated}.</span>}
            {state.saved && (
              <span role="status" className="text-brand">
                Đã lưu.
              </span>
            )}
          </div>
          {state.error && (
            <p role="alert" className="text-danger">
              {state.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
