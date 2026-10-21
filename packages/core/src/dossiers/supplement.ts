import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { endOfVnDay } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import { lockDossier } from "./edit";
import { dossierNotFound, PRELIMINARY_REJECTION_REASON_LABEL, type RejectionGround } from "./model";
import type { SupplementItem, SupplementRequest } from "./supplement-model";
import { transition } from "./transition";

/*
 * L04 CT-11, XA-05 (stories 50 to 54, 56): the Cán bộ xã asks for more on a hồ sơ it has Tiếp nhận, as a
 * list of nội dung with a hạn bổ sung. The Chủ thể answers each one, edits the bản làm việc and nộp lại
 * (see submitDossier), or the xã closes the hồ sơ once the hạn bổ sung has passed.
 */

const MAX_ITEMS = 50;
const MAX_TEXT = 2_000;

export interface SupplementItemInput {
  content: string;
  criterionId?: string | null;
  legalDocumentTypeCode?: string | null;
}

export interface RequestSupplementInput {
  dossierId: string;
  expectedVersion: number;
  /** YYYY-MM-DD, a day in giờ Việt Nam; the hạn bổ sung runs to 23:59:59 of it. */
  deadline: string;
  items: SupplementItemInput[];
}

/** L04 XA-05 (story 50): the xã asks the Chủ thể for more, moving the hồ sơ into Yêu cầu bổ sung. */
export const requestSupplement = (deps: CoreDeps) => askForMore(deps, "dossier.supplement.request");

/**
 * L04 (stories 57, 58): the Sở trả về a hồ sơ Đã chuyển tỉnh to Yêu cầu bổ sung, with the same list of
 * nội dung and hạn bổ sung as a yêu cầu bổ sung of the xã. The nộp lại brings it back to Đã nộp xã.
 */
export const returnFromProvince = (deps: CoreDeps) => askForMore(deps, "dossier.province_return");

/** Opens a yêu cầu bổ sung through `action`: the xã's own, or the Sở trả về. */
function askForMore(deps: CoreDeps, action: "dossier.supplement.request" | "dossier.province_return") {
  return async (actor: Actor, input: RequestSupplementInput): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const deadline = parseDeadline(input.deadline);
    const now = deps.clock.now();
    if (deadline.getTime() < now.getTime()) throw new DomainError("invalid_deadline", "Hạn bổ sung đã qua");
    const items = parseItems(input.items);
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, {
        action,
        expectedVersion: input.expectedVersion,
        // L08 (story 18): a Sở trả về ends the lượt gửi tỉnh, so the next one is Tiếp nhận tại tỉnh afresh.
        patch: action === "dossier.province_return" ? { supplementDeadline: deadline, provinceReceivedAt: null, provinceReceivedBy: null } : { supplementDeadline: deadline },
        metadata: { deadline: deadline.toISOString(), itemCount: items.length },
      });
      const set = items.some((i) => i.criterionId) ? await tx.criteriaVersions.findSet(before.criteriaSetId) : null;
      const types = items.some((i) => i.legalDocumentTypeCode) ? new Set((await tx.legalDocuments.types()).map((ty) => ty.code)) : new Set<string>();
      for (const item of items) {
        if (item.criterionId && !set?.rows.criteria.some((c) => c.id === item.criterionId)) {
          throw new DomainError("criterion_not_in_set", "Tiêu chí không thuộc Bộ tiêu chí của hồ sơ");
        }
        if (item.legalDocumentTypeCode && !types.has(item.legalDocumentTypeCode)) throw new DomainError("invalid_document_type", "Loại giấy tờ không hợp lệ");
      }
      const requestId = deps.ids.next();
      await tx.supplements.insert({
        id: requestId,
        dossierId: before.id,
        requestedBy: actor.userId,
        requestedRole: actor.activeRole!,
        requestedAt: now,
        deadline,
        closedAt: null,
        outcome: null,
        items: items.map((item, i) => ({
          id: deps.ids.next(),
          requestId,
          position: i + 1,
          ...item,
          response: "",
          respondedAt: null,
          respondedBy: null,
        })),
      });
      return { version: after.version };
    });
  };
}

function parseDeadline(value: unknown): Date {
  if (typeof value !== "string") throw new DomainError("invalid_deadline", "Nhập hạn bổ sung");
  try {
    return endOfVnDay(value);
  } catch {
    throw new DomainError("invalid_deadline", "Hạn bổ sung không hợp lệ");
  }
}

function parseItems(items: unknown): Pick<SupplementItem, "content" | "criterionId" | "legalDocumentTypeCode">[] {
  if (!Array.isArray(items) || items.length === 0) throw new DomainError("items_required", "Nhập ít nhất một nội dung cần bổ sung");
  if (items.length > MAX_ITEMS) throw new DomainError("too_many_items", `Tối đa ${MAX_ITEMS} nội dung cho một yêu cầu bổ sung`);
  return items.map((raw: SupplementItemInput) => {
    const content = typeof raw?.content === "string" ? raw.content.trim() : "";
    if (content === "") throw new DomainError("items_required", "Nội dung cần bổ sung không được để trống");
    if (content.length > MAX_TEXT) throw new DomainError("field_too_long", "Nội dung quá dài");
    const criterionId = raw.criterionId || null;
    const legalDocumentTypeCode = raw.legalDocumentTypeCode || null;
    if (criterionId && legalDocumentTypeCode) throw new DomainError("one_target", "Mỗi nội dung gắn với một tiêu chí hoặc một loại giấy tờ, không cả hai");
    if (criterionId !== null && !isUuid(criterionId)) throw new DomainError("criterion_not_in_set", "Tiêu chí không thuộc Bộ tiêu chí của hồ sơ");
    if (legalDocumentTypeCode !== null && typeof legalDocumentTypeCode !== "string") throw new DomainError("invalid_document_type", "Loại giấy tờ không hợp lệ");
    return { content, criterionId, legalDocumentTypeCode };
  });
}

const itemNotFound = () => new DomainError("not_found", "Không tìm thấy nội dung yêu cầu bổ sung");

/** L04 CT-11 (story 51): the Chủ thể answers one nội dung of the open yêu cầu bổ sung, replacing any earlier answer. */
export function respondSupplementItem(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; itemId: string; response: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const response = typeof input.response === "string" ? input.response.trim() : "";
    if (response.length > MAX_TEXT) throw new DomainError("field_too_long", "Nội dung quá dài");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.supplement.respond",
        expectedVersion: input.expectedVersion,
        metadata: { itemId: input.itemId },
      });
      const open = await tx.supplements.findOpen(before.id);
      const item = isUuid(input.itemId) ? open?.items.find((i) => i.id === input.itemId) : undefined;
      if (!item) throw itemNotFound();
      await tx.supplements.respond(item.id, { response, respondedAt: after.updatedAt, respondedBy: actor.userId });
      return { version: after.version };
    });
  };
}

/**
 * L04 XA-05 (story 56): once the hạn bổ sung has passed without a nộp lại, the xã closes the hồ sơ as
 * Không đạt sơ bộ with lý do "Không bổ sung", which also closes the yêu cầu bổ sung.
 */
export function closeUnsupplemented(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      // The Lý do loại sơ bộ "Không bổ sung" (story 63), in the shape rejectionOf() reads.
      const ground: RejectionGround = { kind: "preliminary_reason", reasonCode: "no_supplement", text: PRELIMINARY_REJECTION_REASON_LABEL.no_supplement, explanation: "" };
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.supplement.close",
        expectedVersion: input.expectedVersion,
        patch: { supplementDeadline: null },
        reason: ground.text,
        metadata: { ...ground, supplementDeadline: before.supplementDeadline?.toISOString() ?? null },
      });
      const open = await tx.supplements.findOpen(before.id);
      if (open) await tx.supplements.close(open.id, after.updatedAt, "closed_unsupplemented");
      return { version: after.version };
    });
  };
}

/** A yêu cầu bổ sung as shown: each nội dung with the Tiêu chí or loại giấy tờ it is tied to, by name. */
export interface SupplementRequestView extends Omit<SupplementRequest, "items"> {
  items: (SupplementItem & { criterion: { code: string; name: string } | null; legalDocumentTypeName: string | null })[];
}

/** Every yêu cầu bổ sung of a hồ sơ within the reader's Phạm vi, oldest first, with the answers. */
export function listSupplementRequests(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<SupplementRequestView[]> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const requests = await tx.supplements.list(dossier.id);
      if (requests.length === 0) return [];
      const set = await tx.criteriaVersions.findSet(dossier.criteriaSetId);
      const criteria = new Map((set?.rows.criteria ?? []).map((c) => [c.id, { code: c.code, name: c.name }]));
      const types = new Map((await tx.legalDocuments.types()).map((ty) => [ty.code, ty.name]));
      return requests.map((r) => ({
        ...r,
        items: r.items.map((i) => ({
          ...i,
          criterion: (i.criterionId && criteria.get(i.criterionId)) || null,
          legalDocumentTypeName: (i.legalDocumentTypeCode && types.get(i.legalDocumentTypeCode)) || null,
        })),
      }));
    });
  };
}
