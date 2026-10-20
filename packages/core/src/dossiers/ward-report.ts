import { auditEntry } from "../audit/audit";
import type { WardReportData } from "../documents/renderer";
import { ENTITY_KIND_LABEL } from "../entities/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { checklistOf } from "./checklist";
import { vnDate, vnNumber } from "./documents";
import { lockDossier } from "./edit";
import { CHECKLIST_RESULT_LABEL, DOSSIER_STATE_LABEL, dossierNotFound, type Dossier, type Submission } from "./model";
import { transition } from "./transition";

const fileNotFound = () => new DomainError("not_found", "Không tìm thấy tệp");

/*
 * L06 XA-07 (#42, stories 64 to 67): the Cán bộ xã generates the Báo cáo đánh giá cấp xã of a hồ sơ from
 * its newest Phiên bản nộp and Checklist sơ bộ, has it signed outside the system, uploads the signed PDF,
 * then gửi tỉnh. One report per hồ sơ; no batch report.
 */

const SUGGESTION_LABEL = { eligible: "Đủ điều kiện chuyển tỉnh", not_eligible: "Chưa đủ điều kiện chuyển tỉnh" } as const;

const wardReportFileName = (submissionNumber: number) => `Báo cáo đánh giá cấp xã - Phiên bản nộp ${submissionNumber}.docx`;

/**
 * Story 64: the Báo cáo đánh giá cấp xã as a Word file, filled from the newest Phiên bản nộp and the
 * Checklist sơ bộ as it stands. Nothing is stored: the xã prints it, has it signed and uploads the PDF.
 */
export function generateWardReport(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<{ fileName: string; bytes: Uint8Array }> => {
    authorize(actor, "dossier.ward_report.generate");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      if (dossier.state !== "submitted_to_ward") {
        throw new DomainError("invalid_state", `Không thể lập báo cáo khi hồ sơ đang ở trạng thái ${DOSSIER_STATE_LABEL[dossier.state]}`);
      }
      if (dossier.receivedAt === null) throw new DomainError("not_received", "Hồ sơ chưa được tiếp nhận");
      const latest = await tx.dossiers.latestSubmission(dossier.id);
      if (!latest) throw dossierNotFound();
      const { items, results } = await checklistOf(tx, dossier);
      const round = await tx.rounds.findById(latest.roundId);
      const ward = await tx.wards.findById(latest.wardId);
      const now = deps.clock.now();
      const eligible = items.length > 0 && items.every((i) => results.get(i.code)?.result === "pass");
      const data = wardReportData(latest, {
        wardName: ward?.name ?? "",
        roundName: round?.name ?? "",
        checklist: items.map((item, n) => {
          const r = results.get(item.code);
          return { index: String(n + 1), label: item.label, result: r ? CHECKLIST_RESULT_LABEL[r.result] : "Chưa đánh giá" };
        }),
        suggestion: SUGGESTION_LABEL[eligible ? "eligible" : "not_eligible"],
        generatedOn: vnDate(vnDateOf(now)),
      });
      const bytes = await deps.documents.render("ward_report", data);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "dossier.ward_report.generate",
          targetType: "dossier",
          targetId: dossier.id,
          metadata: { submissionNumber: latest.number },
        }),
      );
      return { fileName: wardReportFileName(latest.number), bytes };
    });
  };
}

function wardReportData(s: Submission, c: Pick<WardReportData, "wardName" | "roundName" | "checklist" | "suggestion" | "generatedOn">): WardReportData {
  const { entity, product, criteriaSet, selfScore } = s.snapshot;
  return {
    ...c,
    entityName: entity.name,
    entityKind: ENTITY_KIND_LABEL[entity.kind],
    identifier: entity.taxCode ?? (entity.personalIdLast4 ? `********${entity.personalIdLast4}` : ""),
    address: entity.address,
    representativeName: entity.representativeName,
    phone: entity.phone,
    productName: product.productName,
    criteriaSetCode: criteriaSet.code,
    criteriaSetName: criteriaSet.name,
    submissionNumber: String(s.number),
    submittedOn: vnDate(vnDateOf(s.submittedAt)),
    selfScoreTotal: vnNumber(selfScore.total),
    selfScoreStar: String(selfScore.star),
  };
}

/**
 * Story 65: ties a signed PDF the Cán bộ xã has uploaded (purpose `signed_ward_report`, scanned clean) to
 * the hồ sơ, for its newest Phiên bản nộp. Uploading again replaces it; earlier ones stay on record.
 */
export function attachSignedWardReport(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; fileId: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      assertIdShape(input.fileId, fileNotFound);
      const file = await tx.files.findById(input.fileId);
      if (!file || file.ownerUserId !== actor.userId || file.purpose !== "signed_ward_report") throw fileNotFound();
      if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa quét xong hoặc đã bị chặn");
      const latest = await tx.dossiers.latestSubmission(before.id);
      if (!latest) throw dossierNotFound();
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.ward_report.attach",
        expectedVersion: input.expectedVersion,
        metadata: { fileId: file.id, submissionNumber: latest.number },
      });
      await tx.dossiers.insertWardReport({
        id: deps.ids.next(),
        dossierId: before.id,
        submissionNumber: latest.number,
        fileId: file.id,
        uploadedBy: actor.userId,
        uploadedAt: deps.clock.now(),
      });
      return { version: after.version };
    });
  };
}

export interface WardReportStatus {
  /** The newest signed report; `current` when it reports on the newest Phiên bản nộp. */
  signed: { fileId: string; fileName: string; submissionNumber: number; uploadedAt: Date; current: boolean } | null;
  /** Every item of the Checklist sơ bộ has a result. */
  checklistComplete: boolean;
  /** Hạn gửi tỉnh of the hồ sơ's đợt; null before the first nộp. */
  forwardingDeadline: Date | null;
  /** Past Hạn gửi tỉnh: gửi tỉnh is refused ("Chờ đợt sau" while still Đã nộp xã, story 68). */
  pastForwardingDeadline: boolean;
}

async function statusOf(tx: Tx, dossier: Dossier, now: Date): Promise<WardReportStatus> {
  const latest = await tx.dossiers.latestSubmission(dossier.id);
  const report = await tx.dossiers.latestWardReport(dossier.id);
  const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
  const { items, results } = await checklistOf(tx, dossier);
  return {
    signed: report && {
      fileId: report.fileId,
      fileName: report.fileName,
      submissionNumber: report.submissionNumber,
      uploadedAt: report.uploadedAt,
      current: report.submissionNumber === latest?.number,
    },
    checklistComplete: items.length > 0 && items.every((i) => results.has(i.code)),
    forwardingDeadline: round?.forwardingDeadline ?? null,
    pastForwardingDeadline: round ? now > round.forwardingDeadline : false,
  };
}

/** Stories 35, 65, 66: the signed report of a hồ sơ within the reader's Phạm vi, and what gửi tỉnh still needs. */
export function wardReportStatus(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<WardReportStatus> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      return statusOf(tx, dossier, deps.clock.now());
    });
  };
}

/** Story 35: a short-lived link to the signed Báo cáo đánh giá cấp xã, for whoever's Phạm vi covers the hồ sơ. */
export function downloadSignedWardReport(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<{ url: string; expiresAt: Date; fileName: string }> => {
    authorize(actor, "dossier.document.download");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const report = await tx.dossiers.latestWardReport(dossier.id);
      const file = report && (await tx.files.findById(report.fileId));
      if (!report || !file) throw fileNotFound();
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "file.download_issued",
          targetType: "file",
          targetId: file.id,
          metadata: { dossierId: dossier.id, submissionNumber: report.submissionNumber, document: "signed_ward_report" },
        }),
      );
      return { url: get.url, expiresAt: get.expiresAt, fileName: file.fileName };
    });
  };
}

/**
 * Stories 66, 67: gửi tỉnh. Refused without a signed Báo cáo đánh giá cấp xã for the newest Phiên bản
 * nộp, with the Checklist sơ bộ not fully assessed, or past Hạn gửi tỉnh of the hồ sơ's đợt. Moves Đã nộp
 * xã to Đã chuyển tỉnh, records the first time it reached the province, and puts on the timeline which
 * Phiên bản nộp, checklist results and signed report went up (never the nhận xét, which the Chủ thể may
 * not read).
 */
export function forwardToProvince(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const now = deps.clock.now();
      const status = await statusOf(tx, before, now);
      const latest = await tx.dossiers.latestSubmission(before.id);
      const { items, results } = await checklistOf(tx, before);
      // transition() first, so that a wrong state, Vai trò or version is reported as such; a missing
      // condition then throws and the transaction rolls the transition back.
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.forward",
        expectedVersion: input.expectedVersion,
        patch: { firstForwardedAt: before.firstForwardedAt ?? now },
        metadata: {
          submissionNumber: latest?.number ?? null,
          wardReportFileId: status.signed?.fileId ?? null,
          checklist: items.map((i) => ({ itemCode: i.code, label: i.label, result: results.get(i.code)?.result ?? null })),
        },
      });
      if (!status.signed?.current) throw new DomainError("ward_report_missing", "Chưa có Báo cáo đánh giá cấp xã đã ký cho Phiên bản nộp mới nhất");
      if (!status.checklistComplete) throw new DomainError("checklist_incomplete", "Chưa đánh giá đủ các mục Checklist sơ bộ");
      if (status.pastForwardingDeadline) throw new DomainError("forwarding_deadline_passed", "Đã quá Hạn gửi tỉnh của đợt; hồ sơ chờ đợt sau");
      return { version: after.version };
    });
  };
}
