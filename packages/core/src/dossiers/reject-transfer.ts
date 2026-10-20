import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { lockDossier } from "./edit";
import { PRELIMINARY_REJECTION_REASON_LABEL, PRELIMINARY_REJECTION_REASONS, type Dossier, type PreliminaryRejectionReason, type RejectionGround } from "./model";
import { transition } from "./transition";

/*
 * L05 XA-06 and Chuyển xã (stories 47 to 49, 63): what a xã does with a hồ sơ Đã nộp xã that it will not
 * evaluate. Loại moves it to Không đạt sơ bộ; Chuyển xã hands it to the right xã without changing its state.
 */

const MAX_TEXT = 2_000;

function text(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length > MAX_TEXT) throw new DomainError("field_too_long", "Nội dung quá dài");
  return s;
}

export interface RejectInput {
  dossierId: string;
  expectedVersion: number;
  /** An Điều kiện loại of the hồ sơ's Bộ tiêu chí; exactly one of this and `reasonCode`. */
  exclusionConditionId?: string | null;
  /** A Lý do loại sơ bộ, which needs a diễn giải. */
  reasonCode?: string | null;
  explanation?: string;
}

/** The ground of a loại: exactly one of an Điều kiện loại of the hồ sơ's own Bộ tiêu chí, or a Lý do loại sơ bộ with a diễn giải. */
async function groundOf(tx: Tx, dossier: Dossier, input: RejectInput): Promise<RejectionGround> {
  const explanation = text(input.explanation);
  const cited = input.exclusionConditionId ?? null;
  const reason = input.reasonCode ?? null;
  if ((cited === null) === (reason === null)) {
    throw new DomainError("rejection_ground_required", "Chọn một Điều kiện loại của Bộ tiêu chí hoặc một Lý do loại sơ bộ");
  }
  if (cited !== null) {
    const found = isUuid(cited) ? await tx.criteriaVersions.findNode("exclusion", cited) : null;
    if (!found || found.row.setId !== dossier.criteriaSetId) {
      throw new DomainError("invalid_exclusion_condition", "Điều kiện loại không thuộc Bộ tiêu chí của hồ sơ");
    }
    return { kind: "exclusion_condition", exclusionConditionId: found.row.id, text: found.row.description, explanation };
  }
  if (!(PRELIMINARY_REJECTION_REASONS as readonly unknown[]).includes(reason)) throw new DomainError("invalid_rejection_reason", "Lý do loại sơ bộ không hợp lệ");
  if (explanation === "") throw new DomainError("explanation_required", "Nhập diễn giải cho lý do loại");
  const reasonCode = reason as PreliminaryRejectionReason;
  return { kind: "preliminary_reason", reasonCode, text: PRELIMINARY_REJECTION_REASON_LABEL[reasonCode], explanation };
}

/**
 * L05 XA-06 (story 63): the xã loại a hồ sơ Đã nộp xã to Không đạt sơ bộ, citing an Điều kiện loại of its
 * Bộ tiêu chí or a Lý do loại sơ bộ with a diễn giải. The Chủ thể sees the ground (story 35).
 */
export function rejectDossier(deps: CoreDeps) {
  return async (actor: Actor, input: RejectInput): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const ground = await groundOf(tx, before, input);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.reject",
        expectedVersion: input.expectedVersion,
        reason: ground.explanation ? `${ground.text}: ${ground.explanation}` : ground.text,
        metadata: { ...ground },
      });
      return { version: after.version };
    });
  };
}

/**
 * Chuyển xã (stories 47 to 49): a Cán bộ xã hands a hồ sơ Đã nộp xã that is not of their địa bàn to the
 * right xã, with a reason. Only the hồ sơ's xã changes, never the Chủ thể's xã đăng ký; the hồ sơ loses its
 * Tiếp nhận and Cán bộ phụ trách, so it waits in the Chờ tiếp nhận of the xã it goes to. From then on the
 * xã it left no longer sees it.
 */
export function transferWard(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; wardId: string; reason: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    const reason = text(input.reason);
    if (reason === "") throw new DomainError("reason_required", "Nhập lý do chuyển xã");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const ward = isUuid(input.wardId) ? await tx.wards.findById(input.wardId) : null;
      if (!ward) throw new DomainError("invalid_ward", "Không tìm thấy xã/phường nhận hồ sơ");
      if (ward.id === before.wardId) throw new DomainError("same_ward", "Hồ sơ đang thuộc xã/phường này");
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.ward_transfer",
        expectedVersion: input.expectedVersion,
        patch: { wardId: ward.id, receivedAt: null, receivedBy: null, handlerUserId: null },
        reason,
        metadata: { fromWardId: before.wardId, toWardId: ward.id },
      });
      return { version: after.version };
    });
  };
}
