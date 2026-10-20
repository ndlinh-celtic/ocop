import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import { endOfVnDay, vnDateOf } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import { isExpired, legalDocumentNotFound, legalStanding, type LegalDocument, type LegalDocumentRecord, type LegalStanding } from "./legal";
import { entityNotFound } from "./model";

export interface LegalDocumentView extends LegalDocumentRecord {
  typeName: string;
  expired: boolean;
}

export interface LegalStandingView extends LegalStanding {
  /** Current giấy tờ, newest first. */
  documents: LegalDocumentView[];
  /** Giấy tờ replaced by a newer one, kept as history (story 8), newest first. */
  history: LegalDocumentView[];
}

/** L01 CT-02: the hồ sơ pháp lý of a Chủ thể within the reader's Phạm vi, with Đã xác thực as of now. */
export function getLegalStanding(deps: CoreDeps) {
  return async (actor: Actor, input: { entityId: string }): Promise<LegalStandingView> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const entity = await tx.entities.findById(scope, input.entityId);
      if (!entity) throw entityNotFound();
      const [types, documents] = await Promise.all([tx.legalDocuments.types(), tx.legalDocuments.list(scope, entity.id)]);
      const now = deps.clock.now();
      const names = new Map(types.map((ty) => [ty.code, ty.name]));
      const views = documents
        .map((d) => ({ ...d, typeName: names.get(d.typeCode) ?? d.typeCode, expired: isExpired(d, now) }))
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
      return {
        ...legalStanding(entity.kind, types, documents, now),
        documents: views.filter((d) => d.replacedBy === null),
        history: views.filter((d) => d.replacedBy !== null),
      };
    });
  };
}

export interface AddLegalDocumentInput {
  entityId: string;
  typeCode: string;
  /** An upload of the actor's own with purpose `legal_document`. */
  fileId: string;
  documentNumber?: string | null;
  /** Ngày cấp, YYYY-MM-DD. */
  issuedOn: string;
  /** Last day of validity, YYYY-MM-DD; null when it does not expire. */
  validUntil: string | null;
  /** A current giấy tờ of the same Loại that this one replaces (story 8). */
  replacesId?: string;
}

function assertDates(input: AddLegalDocumentInput, now: Date) {
  endOfVnDay(input.issuedOn);
  if (input.issuedOn > vnDateOf(now)) throw new DomainError("issued_in_future", "Ngày cấp không được sau ngày hôm nay");
  if (input.validUntil === null) return;
  endOfVnDay(input.validUntil);
  if (input.validUntil < input.issuedOn) throw new DomainError("valid_until_before_issue", "Ngày hết hiệu lực không được trước ngày cấp");
}

const fileRequired = () => new DomainError("file_required", "Tải lên tệp giấy tờ");

/**
 * L01 CT-02 (stories 5, 8): the Chủ thể adds a giấy tờ pháp lý from a file it uploaded through `files`,
 * or replaces a current one of the same Loại, which is kept as history. The file counts toward Đã xác
 * thực only once the scan finds it clean.
 */
export function addLegalDocument(deps: CoreDeps) {
  return async (actor: Actor, input: AddLegalDocumentInput): Promise<{ documentId: string }> => {
    authorize(actor, "entity.legal_document.manage");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      // Locks the Chủ thể so two replacements of one giấy tờ cannot both win.
      const entity = await tx.entities.lock(scope, input.entityId);
      if (!entity) throw entityNotFound();
      const now = deps.clock.now();
      const types = await tx.legalDocuments.types();
      if (!types.some((ty) => ty.code === input.typeCode)) throw new DomainError("legal_document_type_invalid", "Chọn loại giấy tờ");
      assertDates(input, now);

      if (!isUuid(input.fileId)) throw fileRequired();
      const file = await tx.files.findById(input.fileId);
      if (!file || file.ownerUserId !== actor.userId || file.purpose !== "legal_document") throw fileRequired();
      if (file.status === "awaiting_upload") throw new DomainError("file_not_uploaded", "Tệp chưa được tải lên xong");
      if (file.status === "blocked") throw new DomainError("file_blocked", "Tệp đã bị chặn khi quét, hãy tải lên tệp khác");

      let replaced: LegalDocumentRecord | undefined;
      if (input.replacesId !== undefined) {
        replaced = (await tx.legalDocuments.list(scope, entity.id)).find((d) => d.id === input.replacesId);
        if (!replaced) throw legalDocumentNotFound();
        if (replaced.replacedBy !== null) throw new DomainError("legal_document_replaced", "Giấy tờ này đã được thay bằng giấy tờ khác");
        if (replaced.typeCode !== input.typeCode) throw new DomainError("legal_document_type_mismatch", "Giấy tờ thay thế phải cùng loại với giấy tờ cũ");
      }

      const doc: LegalDocument = {
        id: deps.ids.next(),
        entityId: entity.id,
        typeCode: input.typeCode,
        documentNumber: input.documentNumber?.trim() || null,
        issuedOn: input.issuedOn,
        validUntil: input.validUntil,
        fileId: file.id,
        addedBy: actor.userId,
        addedAt: now,
        replacedBy: null,
        replacedAt: null,
      };
      if (!(await tx.legalDocuments.insert(doc))) throw new DomainError("file_already_used", "Tệp này đã được dùng cho một giấy tờ khác");
      if (replaced) await tx.legalDocuments.markReplaced(replaced.id, doc.id, now);

      const action = replaced ? "entity.legal_document.replaced" : "entity.legal_document.added";
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action,
          targetType: "entity",
          targetId: entity.id,
          after: { documentId: doc.id, typeCode: doc.typeCode, documentNumber: doc.documentNumber, issuedOn: doc.issuedOn, validUntil: doc.validUntil, fileId: doc.fileId },
          metadata: replaced ? { replacesId: replaced.id } : {},
        }),
      );
      await emit(deps, tx, { type: action, payload: { entityId: entity.id, documentId: doc.id, replacesId: replaced?.id ?? null } });
      return { documentId: doc.id };
    });
  };
}
