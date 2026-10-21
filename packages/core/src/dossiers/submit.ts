import { isExpired, legalStanding, type LegalDocumentRecord } from "../entities/legal";
import { entityNotFound, type Entity } from "../entities/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { isPastSubmissionDeadline, type Round } from "../rounds/model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { generateSubmissionDocuments } from "./documents";
import { lockDossier } from "./edit";
import {
  dossierNotFound,
  PRODUCT_FIELD_LABEL,
  REQUIRED_PRODUCT_FIELDS,
  type Dossier,
  type ProductField,
  type Submission,
  type SubmissionFileRef,
  type SubmissionSnapshot,
} from "./model";
import { assess, type SelfAssessment } from "./self-assessment";
import { transition } from "./transition";
import { isPastSupplementDeadline, supplementDeadlinePassed } from "./transitions";

/*
 * L03 CT-09, CT-10 (stories 28 to 34): the Chủ thể submits its Nháp into the đợt Đang nhận nộp, which
 * freezes the bản làm việc into a Phiên bản nộp, and may rút it while the xã has not Tiếp nhận it.
 */

/** One reason a hồ sơ cannot be submitted yet (story 29), each listed so the Chủ thể knows what to do. */
export type SubmissionBlocker = { message: string } & (
  | { code: "no_open_round" }
  /** The đợt uses another Phiên bản tiêu chí: the way out is Sao chép sang hồ sơ mới (story 27). */
  | { code: "round_version_mismatch"; roundName: string }
  | { code: "entity_not_verified" }
  | { code: "legal_document_expired"; typeCode: string; typeName: string; validUntil: string }
  | { code: "missing_product_field"; field: ProductField }
  | { code: "criterion_unscored"; criterionId: string; criterionCode: string }
  /** Nộp lại only while the hạn bổ sung lasts (story 53). */
  | { code: "supplement_deadline_passed" }
);

export class SubmissionBlockedError extends DomainError {
  constructor(readonly blockers: readonly SubmissionBlocker[]) {
    super("submission_blocked", `Chưa nộp được hồ sơ: ${blockers.map((b) => b.message).join("; ")}`);
  }
}

interface Conditions {
  round: Round | null;
  entity: Entity;
  documents: LegalDocumentRecord[];
  typeNames: Map<string, string>;
  assessment: SelfAssessment;
  blockers: SubmissionBlocker[];
}

/**
 * The conditions of story 29 on a hồ sơ already loaded within the actor's scope, at `now`. Missing minh
 * chứng and 0-point Mức điểm never block (story 30): the Cán bộ xã decides whether to ask for more.
 * A nộp lại (story 53) stays in the đợt it was submitted into, past its Hạn nộp xã, while the hạn bổ
 * sung lasts.
 */
async function conditions(tx: Tx, actor: UserActor, dossier: Dossier, now: Date): Promise<Conditions> {
  const scope = dataScopeOf(actor);
  const blockers: SubmissionBlocker[] = [];

  let round: Round | null;
  if (dossier.state === "supplement_requested") {
    round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
    if (isPastSupplementDeadline(dossier, now)) blockers.push({ code: "supplement_deadline_passed", message: supplementDeadlinePassed().message });
  } else {
    const open = await tx.rounds.findOpen();
    // A đợt past its Hạn nộp xã no longer takes a first nộp, even before the job has closed it.
    round = open && !isPastSubmissionDeadline(open, now) ? open : null;
  }
  if (!round) {
    blockers.push({ code: "no_open_round", message: "Hiện không có đợt đánh giá nào đang nhận nộp" });
  } else if (round.criteriaVersionId !== dossier.criteriaVersionId) {
    blockers.push({
      code: "round_version_mismatch",
      roundName: round.name,
      message: `${round.name} áp dụng phiên bản tiêu chí khác với hồ sơ này; hãy sao chép sang hồ sơ mới để nộp`,
    });
  }

  const entity = await tx.entities.findById(scope, dossier.entityId);
  if (!entity) throw entityNotFound();
  const types = await tx.legalDocuments.types();
  const documents = (await tx.legalDocuments.list(scope, entity.id)).filter((d) => d.replacedBy === null);
  const typeNames = new Map(types.map((ty) => [ty.code, ty.name]));
  const standing = legalStanding(entity.kind, types, documents, now);
  if (standing.requirements.some((r) => r.required && r.state !== "valid" && r.state !== "expired")) {
    blockers.push({ code: "entity_not_verified", message: "Chủ thể chưa Đã xác thực: còn thiếu giấy tờ pháp lý bắt buộc" });
  }
  for (const r of standing.requirements.filter((r) => r.required && r.state === "expired")) {
    for (const d of documents.filter((d) => d.typeCode === r.typeCode && isExpired(d, now))) {
      blockers.push({
        code: "legal_document_expired",
        typeCode: r.typeCode,
        typeName: r.name,
        validUntil: d.validUntil!,
        message: `${r.name} đã hết hiệu lực`,
      });
    }
  }

  for (const field of REQUIRED_PRODUCT_FIELDS.filter((f) => dossier[f].trim() === "")) {
    blockers.push({ code: "missing_product_field", field, message: `Chưa nhập ${PRODUCT_FIELD_LABEL[field].toLowerCase()}` });
  }

  const assessment = await assess(tx, dossier);
  for (const c of assessment.criteria.filter((c) => c.levelId === null)) {
    blockers.push({ code: "criterion_unscored", criterionId: c.criterionId, criterionCode: c.code, message: `Tiêu chí ${c.code} chưa chọn mức điểm tự chấm` });
  }

  return { round, entity, documents, typeNames, assessment, blockers };
}

/** Story 29: what still stands in the way of submitting the hồ sơ, empty when it can be submitted now. */
export function submissionCheck(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<{ blockers: SubmissionBlocker[] }> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      return { blockers: (await conditions(tx, actor, dossier, deps.clock.now())).blockers };
    });
  };
}

async function snapshotOf(tx: Tx, dossier: Dossier, c: Conditions): Promise<SubmissionSnapshot> {
  const { assessment, entity } = c;
  const version = await tx.criteriaVersions.findById(dossier.criteriaVersionId);
  const linked = new Map(assessment.files.map((f) => [f.fileId, f.criterionIds]));
  return {
    product: {
      productName: dossier.productName,
      description: dossier.description,
      ingredients: dossier.ingredients,
      process: dossier.process,
      packaging: dossier.packaging,
      qualityDeclaration: dossier.qualityDeclaration,
    },
    criteriaSet: { id: assessment.set.id, code: assessment.set.code, name: assessment.set.name },
    criteriaVersion: { id: dossier.criteriaVersionId, legalBasis: version?.legalBasis ?? "" },
    entity: {
      id: entity.id,
      kind: entity.kind,
      name: entity.name,
      taxCode: entity.taxCode,
      personalIdLast4: entity.personalIdLast4,
      address: entity.address,
      representativeName: entity.representativeName,
      phone: entity.phone,
      wardId: entity.wardId,
    },
    legalDocuments: c.documents.map((d) => ({
      id: d.id,
      typeCode: d.typeCode,
      typeName: c.typeNames.get(d.typeCode) ?? d.typeCode,
      documentNumber: d.documentNumber,
      issuedOn: d.issuedOn,
      validUntil: d.validUntil,
      fileId: d.fileId,
      fileName: d.file.fileName,
    })),
    evidence: assessment.files.map((f) => ({ fileId: f.fileId, fileName: f.fileName })),
    criteria: assessment.criteria.map((cr) => ({
      criterionId: cr.criterionId,
      code: cr.code,
      name: cr.name,
      partCode: cr.partCode,
      levelId: cr.levelId!,
      points: cr.points ?? 0,
      explanation: cr.explanation,
      evidenceFileIds: assessment.files.filter((f) => linked.get(f.fileId)?.includes(cr.criterionId)).map((f) => f.fileId),
    })),
    selfScore: { total: assessment.estimate.total, star: assessment.estimate.star },
    // Set by submitDossier once the văn bản are generated from this very snapshot.
    documents: { registrationForm: null, selfAssessmentReport: null },
  };
}

/** The files a Phiên bản nộp refers to, which from then on can never be deleted. */
function filesOf(snapshot: SubmissionSnapshot): SubmissionFileRef[] {
  const { registrationForm, selfAssessmentReport } = snapshot.documents;
  return [
    ...snapshot.evidence.map((e): SubmissionFileRef => ({ fileId: e.fileId, role: "evidence" })),
    ...snapshot.legalDocuments.map((d): SubmissionFileRef => ({ fileId: d.fileId, role: "legal_document" })),
    ...(registrationForm ? [{ fileId: registrationForm, role: "registration_form" } as const] : []),
    ...(selfAssessmentReport ? [{ fileId: selfAssessmentReport, role: "self_assessment_report" } as const] : []),
  ];
}

/**
 * L03 CT-09 (stories 28 to 32): submits a Nháp into the one đợt Đang nhận nộp, without picking it. The
 * hồ sơ takes the xã of its Chủ thể at this moment (story 10) and the đợt, moves to Đã nộp xã, and its
 * bản làm việc is frozen into Phiên bản nộp 1. Every reason it cannot be submitted is listed at once.
 *
 * L04 CT-11 (stories 52 to 54): on a hồ sơ Yêu cầu bổ sung the same call is the nộp lại. It keeps the xã,
 * the đợt, the Tiếp nhận and the Cán bộ phụ trách, freezes the next Phiên bản nộp with its own freshly
 * generated văn bản, and closes the yêu cầu bổ sung.
 */
export function submitDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<{ version: number; submissionNumber: number }> => {
    authorize(actor, "dossier.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const now = deps.clock.now();
      const c = await conditions(tx, actor, before, now);
      const number = ((await tx.dossiers.latestSubmission(before.id))?.number ?? 0) + 1;
      const resubmission = before.state === "supplement_requested";
      const wardId = resubmission && before.wardId ? before.wardId : c.entity.wardId;
      // transition() first, so that a wrong state, Vai trò, version or hạn bổ sung is reported as such;
      // any blocker then throws and the transaction rolls the transition back.
      const after = await transition(deps, tx, actor, before, {
        action: resubmission ? "dossier.resubmit" : "dossier.submit",
        expectedVersion: input.expectedVersion,
        patch: resubmission ? { supplementDeadline: null } : { wardId, roundId: c.round?.id ?? null },
        metadata: { submissionNumber: number, roundId: c.round?.id ?? null, wardId },
      });
      if (c.blockers.length > 0 || !c.round) throw new SubmissionBlockedError(c.blockers);
      if (resubmission) {
        const open = await tx.supplements.findOpen(before.id);
        if (open) await tx.supplements.close(open.id, now, "resubmitted");
      }
      const frozen = await snapshotOf(tx, before, c);
      const ward = await tx.wards.findById(wardId);
      const documents = await generateSubmissionDocuments(deps, tx, actor, frozen, {
        dossierId: before.id,
        number,
        submittedAt: now,
        roundName: c.round.name,
        wardName: ward?.name ?? "",
      });
      const snapshot: SubmissionSnapshot = { ...frozen, documents };
      const submission: Submission = {
        id: deps.ids.next(),
        dossierId: after.id,
        number,
        roundId: c.round.id,
        wardId,
        submittedAt: now,
        submittedBy: actor.userId,
        snapshot,
      };
      await tx.dossiers.insertSubmission(submission, filesOf(snapshot));
      return { version: after.version, submissionNumber: number };
    });
  };
}

const MAX_REASON = 2_000;

/** L03 story 33: rút a hồ sơ Đã nộp xã the xã has not Tiếp nhận yet, with a reason, into Đã rút. */
export function withdrawDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; reason: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason === "") throw new DomainError("reason_required", "Nhập lý do rút hồ sơ");
    if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Nội dung quá dài");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, { action: "dossier.withdraw", expectedVersion: input.expectedVersion, reason });
      return { version: after.version };
    });
  };
}

/** Every Phiên bản nộp of a hồ sơ within the reader's Phạm vi, oldest first (story 31). */
export function listSubmissions(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<Submission[]> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      return tx.dossiers.submissions(dossier.id);
    });
  };
}
