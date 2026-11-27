import { lockDossier } from "../dossiers/edit";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";

/*
 * L16 CT-13, HD-10 Nhận xét chung (#80, spec #79 stories 1 to 8): the Hội đồng's general comment on a hồ sơ Đã chốt
 * điểm, written by the Chủ tịch or Thư ký until Công bố kết quả (the transition row's guard). It is the only nhận xét the
 * Chủ thể ever sees, and only from Công bố kết quả.
 */

export const MAX_GENERAL_COMMENT = 4000;

export interface EditGeneralCommentInput {
  dossierId: string;
  expectedVersion: number;
  /** The whole new text; blank clears it. */
  text: string;
}

/** Stories 1 to 4, 7: writes the Nhận xét chung; the audit row keeps the text before and after. */
export function editGeneralComment(deps: CoreDeps) {
  return async (actor: Actor, input: EditGeneralCommentInput): Promise<{ version: number }> => {
    authorize(actor, "results.general_comment.write");
    if (typeof input.text !== "string") throw new DomainError("general_comment_invalid", "Nhận xét chung không hợp lệ");
    const text = input.text.trim();
    if (text.length > MAX_GENERAL_COMMENT) {
      throw new DomainError("general_comment_too_long", `Nhận xét chung tối đa ${MAX_GENERAL_COMMENT.toLocaleString("vi-VN")} ký tự`);
    }
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const generalComment = text === "" ? null : text;
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.general_comment.edit",
        expectedVersion: input.expectedVersion,
        patch: { generalComment, generalCommentUpdatedAt: deps.clock.now(), generalCommentUpdatedBy: actor.userId },
        metadata: { before: before.generalComment, after: generalComment },
      });
      return { version: after.version };
    });
  };
}
