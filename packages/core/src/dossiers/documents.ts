import { auditEntry } from "../audit/audit";
import type { RegistrationFormData, SelfAssessmentReportData } from "../documents/renderer";
import { renderDocument, type RenderedDocument } from "../documents/templates";
import { storeGeneratedDocument } from "../documents/store";
import { ENTITY_KIND_LABEL } from "../entities/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { formatDayVn, formatDecimalVn } from "../shared/format";
import type { Tx } from "../shared/uow";
import { dossierNotFound, type SubmissionSnapshot } from "./model";

/*
 * L03 (#37, stories 30a, 30b): every nộp generates the Phiếu đăng ký and the Báo cáo tự đánh giá from the
 * snapshot it freezes, stores them as files of their own and ties their ids to the Phiên bản nộp. The
 * files never change afterwards, whatever later happens to the templates or to the hồ sơ.
 */

/** The văn bản generated with each Phiên bản nộp. */
export const SUBMISSION_DOCUMENTS = ["registration_form", "self_assessment_report"] as const;
export type SubmissionDocument = (typeof SUBMISSION_DOCUMENTS)[number];

const DOCUMENT_TITLE: Record<SubmissionDocument, string> = {
  registration_form: "Phiếu đăng ký",
  self_assessment_report: "Báo cáo tự đánh giá",
};

const fileNameOf = (document: SubmissionDocument, submissionNumber: number) => `${DOCUMENT_TITLE[document]} - Phiên bản nộp ${submissionNumber}.docx`;

export interface SubmissionContext {
  number: number;
  submittedAt: Date;
  roundName: string;
  wardName: string;
}

function registrationForm(s: SubmissionSnapshot, c: SubmissionContext): RegistrationFormData {
  const { entity, product } = s;
  return {
    wardName: c.wardName,
    roundName: c.roundName,
    entityName: entity.name,
    entityKind: ENTITY_KIND_LABEL[entity.kind],
    identifier: entity.taxCode ?? (entity.personalIdLast4 ? `********${entity.personalIdLast4}` : ""),
    address: entity.address,
    representativeName: entity.representativeName,
    phone: entity.phone,
    ...product,
    criteriaSetCode: s.criteriaSet.code,
    criteriaSetName: s.criteriaSet.name,
    legalDocuments: s.legalDocuments.map((d) => ({ typeName: d.typeName, documentNumber: d.documentNumber ?? "", issuedOn: formatDayVn(d.issuedOn) })),
    submissionNumber: String(c.number),
    submittedOn: formatDayVn(vnDateOf(c.submittedAt)),
  };
}

function selfAssessmentReport(s: SubmissionSnapshot, c: SubmissionContext): SelfAssessmentReportData {
  const fileNames = new Map(s.evidence.map((e) => [e.fileId, e.fileName]));
  return {
    entityName: s.entity.name,
    address: s.entity.address,
    representativeName: s.entity.representativeName,
    productName: s.product.productName,
    criteriaSetCode: s.criteriaSet.code,
    criteriaSetName: s.criteriaSet.name,
    legalBasis: s.criteriaVersion.legalBasis,
    roundName: c.roundName,
    criteria: s.criteria.map((cr) => ({
      partCode: cr.partCode,
      code: cr.code,
      name: cr.name,
      points: formatDecimalVn(cr.points),
      explanation: cr.explanation,
      evidence: cr.evidenceFileIds.map((id) => fileNames.get(id) ?? "").join("; "),
    })),
    total: formatDecimalVn(s.selfScore.total),
    star: String(s.selfScore.star),
    submissionNumber: String(c.number),
    submittedOn: formatDayVn(vnDateOf(c.submittedAt)),
  };
}

/**
 * Generates both văn bản of a Phiên bản nộp being written, inside the transaction of the nộp: if
 * rendering or storing fails, the nộp fails with it.
 */
export async function generateSubmissionDocuments(
  deps: CoreDeps,
  tx: Tx,
  actor: UserActor,
  snapshot: SubmissionSnapshot,
  c: SubmissionContext & { dossierId: string },
): Promise<SubmissionSnapshot["documents"]> {
  const store = (document: SubmissionDocument, { bytes, templateVersionId }: RenderedDocument) =>
    storeGeneratedDocument(deps, tx, actor, {
      fileName: fileNameOf(document, c.number),
      bytes,
      metadata: { dossierId: c.dossierId, submissionNumber: c.number, document, templateVersionId },
    });
  const registration = await renderDocument(deps, tx, "registration_form", registrationForm(snapshot, c));
  const report = await renderDocument(deps, tx, "self_assessment_report", selfAssessmentReport(snapshot, c));
  return {
    registrationForm: await store("registration_form", registration),
    selfAssessmentReport: await store("self_assessment_report", report),
  };
}

const documentNotFound = () => new DomainError("not_found", "Không tìm thấy văn bản");

/**
 * A short-lived link to the Phiếu đăng ký or Báo cáo tự đánh giá of one Phiên bản nộp, for whoever sees
 * the hồ sơ through their Phạm vi: the Chủ thể, and the Cán bộ xã of the xã it was submitted to. Any other
 * hồ sơ is not found.
 */
export function downloadSubmissionDocument(deps: CoreDeps) {
  return async (
    actor: Actor,
    input: { dossierId: string; submissionNumber: number; document: SubmissionDocument },
  ): Promise<{ url: string; expiresAt: Date; fileName: string }> => {
    authorize(actor, "dossier.document.download");
    const scope = dataScopeOf(actor);
    if (!SUBMISSION_DOCUMENTS.includes(input.document)) throw documentNotFound();
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const submission = (await tx.dossiers.submissions(dossier.id)).find((s) => s.number === input.submissionNumber);
      const { registrationForm: formId, selfAssessmentReport: reportId } = submission?.snapshot.documents ?? {};
      const fileId = input.document === "registration_form" ? formId : reportId;
      if (!fileId) throw documentNotFound();
      const file = await tx.files.findById(fileId);
      if (!file) throw documentNotFound();
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "file.download_issued",
          targetType: "file",
          targetId: file.id,
          metadata: { dossierId: dossier.id, submissionNumber: input.submissionNumber, document: input.document },
        }),
      );
      return { url: get.url, expiresAt: get.expiresAt, fileName: file.fileName };
    });
  };
}
