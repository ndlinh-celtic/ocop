import { auditEntry } from "../audit/audit";
import { issueFileDownload } from "../files/download";
import { PDF_TYPE } from "../documents/pdf";
import type { CertificateData } from "../documents/renderer";
import { storeGeneratedDocument } from "../documents/store";
import { renderDocument } from "../documents/templates";
import { ownUpload } from "../files/attach";
import { authorize } from "../identity/policy";
import { dataScopeOf, type DataScope } from "../identity/scope";
import type { ConsumerContext } from "../platform/consumer-context";
import { emit } from "../platform/emit";
import { systemActor, type Actor, type UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { formatDayVn } from "../shared/format";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { certificateSettingsIn } from "../system/settings";
import {
  CERTIFICATE_STATES,
  certificateExpiry,
  formatCertificateCode,
  orderForNumbering,
  type Certificate,
  type CertificateFilter,
  type CertificateState,
} from "./certificate-model";
import type { RecognitionDecision } from "./decision-model";

/*
 * L16 HD-11 Giấy chứng nhận (#84, spec #79 stories 22 to 31, 34). Numbered in the transaction that records the quyết
 * định (issueCertificates); the bản nháp PDF is generated after it by the outbox consumer draftCertificate, so a slow
 * or failing Gotenberg never blocks the recording; the Cán bộ Sở then uploads the signed PDF, again with a lý do.
 */

const certificateNotFound = () => new DomainError("not_found", "Không tìm thấy giấy chứng nhận");
const decisionNotFound = () => new DomainError("not_found", "Không tìm thấy Quyết định công nhận");
const MAX_REASON = 1000;

/** The year a số thứ tự belongs to: the year of the ngày ký (YYYY-MM-DD). */
export const yearOf = (isoDay: string) => Number(isoDay.slice(0, 4));

/**
 * Stories 22 to 25, 31: one Giấy chứng nhận per hồ sơ recognized by `decision`, in the caller's transaction, numbered
 * by Hạng công nhận then mã hồ sơ from the counter of the year of the ngày ký. A Quyết định công nhận bổ sung (#88)
 * passes Hạng công nhận 4 for its hồ sơ Bộ trả về (ADR 0009).
 */
export async function issueCertificates(
  deps: CoreDeps,
  tx: Tx,
  actor: UserActor,
  decision: RecognitionDecision,
  recognized: readonly { dossierId: string; recognizedStar: number }[],
): Promise<Certificate[]> {
  if (recognized.length === 0) return [];
  const settings = await certificateSettingsIn(tx);
  const scope = dataScopeOf(actor);
  const rows: { dossierId: string; recognizedStar: number; code: string; entityId: string }[] = [];
  for (const r of recognized) {
    const d = await tx.dossiers.findById(scope, r.dossierId);
    if (!d) throw new DomainError("not_found", "Không tìm thấy hồ sơ");
    rows.push({ ...r, code: d.code, entityId: d.entityId });
  }
  const year = yearOf(decision.signedOn);
  const now = deps.clock.now();
  const issued: Certificate[] = [];
  for (const r of orderForNumbering(rows)) {
    const seq = await tx.certificates.nextSeq(year);
    const cert: Certificate = {
      id: deps.ids.next(),
      dossierId: r.dossierId,
      decisionId: decision.id,
      year,
      seq,
      code: formatCertificateCode(seq, year, settings.codeSuffix),
      recognizedStar: r.recognizedStar,
      issuedOn: decision.signedOn,
      expiresOn: certificateExpiry(decision.signedOn, settings.validityMonths),
      state: "awaiting_signature",
      draftFileId: null,
      templateVersionId: null,
      issuedAt: now,
    };
    await tx.certificates.insert(cert);
    await tx.audit.append(
      auditEntry(actor, deps.ids.next(), now, {
        action: "results.certificate.issued",
        targetType: "certificate",
        targetId: cert.id,
        after: { code: cert.code, dossierId: cert.dossierId, recognizedStar: cert.recognizedStar, issuedOn: cert.issuedOn, expiresOn: cert.expiresOn },
        metadata: { decisionId: decision.id },
      }),
    );
    await emit(deps, tx, {
      type: "certificate.issued",
      payload: { certificateId: cert.id, dossierId: cert.dossierId, entityId: r.entityId, decisionId: decision.id },
    });
    issued.push(cert);
  }
  return issued;
}

const SYSTEM_SCOPE: DataScope = { kind: "province" };

async function certificateData(tx: Tx, cert: Certificate, decision: RecognitionDecision): Promise<CertificateData> {
  const dossier = await tx.dossiers.findById(SYSTEM_SCOPE, cert.dossierId);
  const entity = dossier && (await tx.dossiers.latestSubmission(dossier.id))?.snapshot.entity;
  return {
    code: cert.code,
    productName: dossier?.productName ?? "",
    entityName: entity?.name ?? "",
    address: entity?.address ?? "",
    star: `${cert.recognizedStar} sao`,
    issuedOn: formatDayVn(cert.issuedOn),
    expiresOn: formatDayVn(cert.expiresOn),
    decisionNumber: decision.number,
    decisionSignedOn: formatDayVn(decision.signedOn),
  };
}

const fileNameOf = (cert: Pick<Certificate, "code">) => `Giay chung nhan ${cert.code.replace(/\//g, "-")}.pdf`;

/**
 * Outbox consumer of certificate.issued and certificate.amended (story 26, 30): fills the mẫu đang dùng of `certificate`,
 * converts it to PDF and stores it as the bản nháp of a giấy still Chờ ký that has none. A PdfConversionError propagates
 * so the job is retried.
 */
export async function draftCertificate({ deps, tx, event }: ConsumerContext): Promise<void> {
  if (event.type !== "certificate.issued" && event.type !== "certificate.amended") return;
  const cert = await tx.certificates.lock(event.payload.certificateId);
  if (!cert || cert.state !== "awaiting_signature" || cert.draftFileId !== null) return;
  const decision = await tx.recognitionDecisions.findById(cert.decisionId);
  if (!decision) throw new Error(`decision ${cert.decisionId} of certificate ${cert.id} is missing`);
  const { bytes, templateVersionId } = await renderDocument(deps, tx, "certificate", await certificateData(tx, cert, decision));
  const pdf = await deps.pdf.toPdf(bytes);
  const fileId = await storeGeneratedDocument(deps, tx, systemActor("results.certificate-draft"), {
    fileName: fileNameOf(cert),
    bytes: pdf,
    contentType: PDF_TYPE,
    ownerUserId: decision.recordedBy,
    metadata: { certificateId: cert.id, templateVersionId },
  });
  await tx.certificates.update({ ...cert, draftFileId: fileId, templateVersionId });
}

export interface CertificateView {
  id: string;
  code: string;
  year: number;
  seq: number;
  recognizedStar: number;
  issuedOn: string;
  expiresOn: string;
  state: CertificateState;
  /** "generating" while the bản nháp is being made ("đang tạo"). */
  draft: "generating" | "ready";
  /** How many signed PDFs were uploaded; the newest is the bản hiện hành. */
  signedCount: number;
  dossier: { id: string; code: string; productName: string; entityName: string };
  decision: { id: string; number: string; signedOn: string };
}

export interface ListCertificatesInput {
  year?: number | undefined;
  state?: CertificateState | undefined;
  decisionId?: string | undefined;
}

function filterOf(input: ListCertificatesInput): CertificateFilter {
  const filter: CertificateFilter = {};
  if (input.year !== undefined) {
    if (!Number.isInteger(input.year)) throw new DomainError("invalid_filter", "Năm không hợp lệ");
    filter.year = input.year;
  }
  if (input.state !== undefined) {
    if (!(CERTIFICATE_STATES as readonly string[]).includes(input.state)) throw new DomainError("invalid_filter", "Trạng thái không hợp lệ");
    filter.state = input.state;
  }
  if (input.decisionId !== undefined) {
    assertIdShape(input.decisionId, decisionNotFound);
    filter.decisionId = input.decisionId;
  }
  return filter;
}

async function viewOf(tx: Tx, scope: DataScope, cert: Certificate, decisions: Map<string, RecognitionDecision | null>): Promise<CertificateView> {
  if (!decisions.has(cert.decisionId)) decisions.set(cert.decisionId, await tx.recognitionDecisions.findById(cert.decisionId));
  const decision = decisions.get(cert.decisionId)!;
  const dossier = await tx.dossiers.findById(scope, cert.dossierId);
  const entity = dossier && (await tx.dossiers.latestSubmission(dossier.id))?.snapshot.entity;
  return {
    id: cert.id,
    code: cert.code,
    year: cert.year,
    seq: cert.seq,
    recognizedStar: cert.recognizedStar,
    issuedOn: cert.issuedOn,
    expiresOn: cert.expiresOn,
    state: cert.state,
    draft: cert.draftFileId ? "ready" : "generating",
    signedCount: (await tx.certificates.signedFiles(cert.id)).length,
    dossier: { id: cert.dossierId, code: dossier?.code ?? "", productName: dossier?.productName ?? "", entityName: entity?.name ?? "" },
    decision: { id: cert.decisionId, number: decision?.number ?? "", signedOn: decision?.signedOn ?? "" },
  };
}

/** Story 34: the Giấy chứng nhận, newest year first then by số thứ tự, filtered by năm, trạng thái and quyết định. */
export function listCertificates(deps: CoreDeps) {
  return async (actor: Actor, input: ListCertificatesInput = {}): Promise<CertificateView[]> => {
    authorize(actor, "results.certificate.manage");
    const filter = filterOf(input);
    return deps.uow.run(async (tx) => {
      const scope = dataScopeOf(actor);
      const decisions = new Map<string, RecognitionDecision | null>();
      const out: CertificateView[] = [];
      for (const cert of await tx.certificates.list(filter)) out.push(await viewOf(tx, scope, cert, decisions));
      return out;
    });
  };
}

export interface UploadSignedCertificateInput {
  certificateId: string;
  /** The signed PDF uploaded with purpose `signed_certificate`. */
  fileId: string;
  /** Required from the second upload on (story 29). */
  reason?: string | undefined;
}

/** Stories 28, 29: the signed PDF of a giấy; Chờ ký → Đã ký. A re-upload needs a lý do; every earlier one is kept. */
export function uploadSignedCertificate(deps: CoreDeps) {
  return async (actor: Actor, input: UploadSignedCertificateInput): Promise<{ n: number; state: CertificateState }> => {
    authorize(actor, "results.certificate.manage");
    assertIdShape(input.certificateId, certificateNotFound);
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Lý do quá dài");
    return deps.uow.run(async (tx) => {
      const before = await tx.certificates.lock(input.certificateId);
      if (!before) throw certificateNotFound();
      const n = (await tx.certificates.signedFiles(before.id)).length + 1;
      if (n > 1 && reason === "") throw new DomainError("reason_required", "Nhập lý do tải lại bản đã ký");
      const file = await ownUpload(
        tx,
        actor,
        input.fileId,
        "signed_certificate",
        () => new DomainError("file_required", "Tải lên bản giấy chứng nhận đã ký (PDF)"),
      );
      const now = deps.clock.now();
      await tx.certificates.addSignedFile({ certificateId: before.id, n, fileId: file.id, reason: reason || null, uploadedBy: actor.userId, uploadedAt: now });
      const after: Certificate = { ...before, state: "signed" };
      await tx.certificates.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.certificate.signed",
          targetType: "certificate",
          targetId: before.id,
          before: { state: before.state },
          after: { state: after.state },
          metadata: { n, fileId: file.id, reason: reason || null },
        }),
      );
      const dossier = await tx.dossiers.findById(dataScopeOf(actor), before.dossierId);
      if (!dossier) throw certificateNotFound();
      await emit(deps, tx, { type: "certificate.signed", payload: { certificateId: before.id, dossierId: before.dossierId, entityId: dossier.entityId, n } });
      return { n, state: after.state };
    });
  };
}

/** Story 27: a short-lived link to the bản nháp, or to the newest signed PDF, audited like any download. */
export function downloadCertificate(deps: CoreDeps) {
  return async (actor: Actor, input: { certificateId: string; version: "draft" | "signed" }): Promise<{ url: string; expiresAt: Date }> => {
    authorize(actor, "results.certificate.manage");
    assertIdShape(input.certificateId, certificateNotFound);
    return deps.uow.run(async (tx) => {
      const cert = await tx.certificates.findById(input.certificateId);
      if (!cert) throw certificateNotFound();
      const fileId = input.version === "draft" ? cert.draftFileId : ((await tx.certificates.signedFiles(cert.id)).at(-1)?.fileId ?? null);
      if (!fileId) {
        throw input.version === "draft"
          ? new DomainError("certificate_draft_pending", "Bản nháp giấy chứng nhận đang được tạo")
          : new DomainError("not_found", "Giấy chứng nhận chưa có bản đã ký");
      }
      return issueFileDownload(deps, tx, actor, fileId, certificateNotFound, { certificateId: cert.id, version: input.version });
    });
  };
}

async function readAll(deps: CoreDeps, storageKey: string): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const c of await deps.files.read(storageKey)) chunks.push(c);
  return Buffer.concat(chunks);
}

/**
 * Story 27: the bản nháp of every giấy of a quyết định, for one ZIP to send for ký hàng loạt. Refused while one is
 * still being generated, so the ZIP is never short of a giấy.
 */
export function certificateDrafts(deps: CoreDeps) {
  return async (actor: Actor, input: { decisionId: string }): Promise<{ fileName: string; files: { name: string; bytes: Uint8Array }[] }> => {
    authorize(actor, "results.certificate.manage");
    assertIdShape(input.decisionId, decisionNotFound);
    return deps.uow.run(async (tx) => {
      const decision = await tx.recognitionDecisions.findById(input.decisionId);
      if (!decision) throw decisionNotFound();
      const certs = await tx.certificates.ofDecision(decision.id);
      if (certs.length === 0) throw new DomainError("not_found", "Quyết định không có giấy chứng nhận");
      if (certs.some((c) => c.draftFileId === null)) {
        throw new DomainError("certificate_draft_pending", "Còn bản nháp giấy chứng nhận đang được tạo, thử lại sau ít phút");
      }
      const files: { name: string; bytes: Uint8Array }[] = [];
      for (const c of certs) {
        const file = await tx.files.findById(c.draftFileId!);
        if (!file) throw new Error(`draft ${c.draftFileId} of certificate ${c.id} is missing`);
        files.push({ name: fileNameOf(c), bytes: await readAll(deps, file.storageKey) });
      }
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "results.certificate.drafts_downloaded",
          targetType: "recognition_decision",
          targetId: decision.id,
          metadata: { certificates: certs.map((c) => c.id) },
        }),
      );
      return { fileName: `Giay chung nhan - QD ${decision.number.replace(/[\\/:*?"<>|]+/g, "-")}.zip`, files };
    });
  };
}
