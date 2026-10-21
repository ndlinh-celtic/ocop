import { ownUpload } from "../files/attach";
import { auditEntry } from "../audit/audit";
import { assembleSet } from "../criteria/detail";
import { criteriaOf } from "../criteria/model";
import { rankStoredSet } from "../criteria/star-rank";
import type { SetRows } from "../criteria/version";
import { lockDossier } from "../dossiers/edit";
import { dossierNotFound, versionConflict, type Dossier, type DossierState, type Submission } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import { isAssignmentActive } from "../identity/model";
import { dataScopeOf } from "../identity/scope";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError, forbidden } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import {
  EVIDENCE_ASSESSMENTS,
  type AdvisoryReportDraft,
  type AdvisoryReportLine,
  type AdvisoryReportSnapshot,
  type AdvisoryReportVersion,
  type EvidenceAssessment,
} from "./advisory-report-model";

/*
 * L10 TM-01, TM-02, TM-05, TM-06 and L11 TM-07, TM-12 (#56, spec #49 stories 42 to 50, 56 to 64): the Báo cáo
 * Tổ tư vấn of a hồ sơ. The Thành viên Tổ tư vấn Phân công on it write one nháp together while it is in Tổ tư
 * vấn thẩm định; the Tổ trưởng issues it as phiên bản 1, and later as N+1 with a reason, until the hồ sơ is Đã
 * chốt điểm. Every phiên bản is fixed. The thành viên chấm, Chủ tịch and Thư ký read the phiên bản, never the nháp.
 */

const MAX_TEXT = 20_000;
const MAX_FILES = 50;

/** Story 57: the Tiêu chí still without Điểm đề xuất or căn cứ, by code, in sheet order. */
export class AdvisoryReportIncomplete extends DomainError {
  static override readonly brand = "AdvisoryReportIncomplete";

  constructor(readonly criteria: string[]) {
    super("advisory_report_incomplete", `Còn tiêu chí chưa có Điểm đề xuất hoặc căn cứ: ${criteria.join(", ")}`);
  }
}

export interface AdvisoryReportLineInput {
  criterionId: string;
  levelId: string | null;
  basis: string;
  evidenceFileIds: string[];
  evidenceAssessment: EvidenceAssessment | null;
}

/** The whole content of the nháp, as the editor holds it: a Tiêu chí without a line is blank. */
export interface AdvisoryReportContent {
  lines: AdvisoryReportLineInput[];
  summary: string;
  notes: string;
  attachmentFileIds: string[];
}

export interface AdvisoryCriterionView {
  criterionId: string;
  code: string;
  name: string;
  partCode: string;
  maxPoints: number;
  levels: { id: string; description: string; points: number }[];
  /** What the Chủ thể submitted for it in the newest Phiên bản nộp (story 43). */
  submitted: { points: number | null; explanation: string; evidence: { fileId: string; fileName: string }[] };
  /** The nháp's line; blank when nobody has written it yet. */
  line: AdvisoryReportLine & { points: number | null };
}

export interface AdvisoryReportVersionSummary {
  id: string;
  number: number;
  issuedAt: Date;
  issuedBy: { userId: string; fullName: string };
  reason: string | null;
}

export interface AdvisoryReportWorkspace {
  dossierId: string;
  /** The hồ sơ's version and state, for phát hành. */
  dossierVersion: number;
  state: DossierState;
  draftVersion: number;
  criteria: AdvisoryCriterionView[];
  summary: string;
  notes: string;
  attachments: { fileId: string; fileName: string; status: string }[];
  /** Story 46: Tổng Phần A/B/C, tổng điểm and Hạng sao ước lượng; a Tiêu chí without Điểm đề xuất counts 0. */
  estimate: { parts: { code: string; total: number }[]; total: number; star: number };
  /** Story 57: codes of the Tiêu chí phát hành would refuse. */
  missing: string[];
  /** Whether the reader is the Tổ trưởng of the Hội đồng now (story 58), so the page offers phát hành. */
  isLeader: boolean;
  updatedAt: Date | null;
  updatedBy: { userId: string; fullName: string } | null;
  versions: AdvisoryReportVersionSummary[];
}

/** The Bộ tiêu chí of the hồ sơ, fixed at creation in a published Phiên bản tiêu chí. */
async function setOf(tx: Tx, dossier: Dossier): Promise<SetRows> {
  const found = await tx.criteriaVersions.findSet(dossier.criteriaSetId);
  if (!found) throw new Error(`criteria set ${dossier.criteriaSetId} of dossier ${dossier.id} is missing`);
  return found.rows;
}

const blankLine = (criterionId: string): AdvisoryReportLine => ({ criterionId, levelId: null, basis: "", evidenceFileIds: [], evidenceAssessment: null });

/** Checks the content against the hồ sơ's Bộ tiêu chí and newest Phiên bản nộp, and returns it as lines in sheet order. */
async function validContent(tx: Tx, actor: UserActor, rows: SetRows, latest: Submission | null, kept: readonly string[], input: AdvisoryReportContent) {
  const text = (value: unknown) => {
    if (typeof value !== "string" || value.length > MAX_TEXT) throw new DomainError("field_too_long", "Nội dung quá dài");
    return value.trim();
  };
  if (!Array.isArray(input.lines) || !Array.isArray(input.attachmentFileIds)) throw new DomainError("invalid_input", "Nội dung báo cáo không hợp lệ");
  const evidence = new Set(latest?.snapshot.evidence.map((e) => e.fileId) ?? []);
  const byId = new Map<string, AdvisoryReportLine>();
  for (const l of input.lines) {
    if (!isUuid(l.criterionId) || !rows.criteria.some((c) => c.id === l.criterionId)) {
      throw new DomainError("criterion_not_in_set", "Tiêu chí không thuộc Bộ tiêu chí của hồ sơ");
    }
    if (byId.has(l.criterionId)) throw new DomainError("invalid_input", "Một tiêu chí chỉ có một dòng");
    if (l.levelId !== null && !rows.levels.some((v) => v.id === l.levelId && v.criterionId === l.criterionId)) {
      throw new DomainError("level_not_in_criterion", "Mức điểm đã chọn không thuộc tiêu chí này");
    }
    if (l.evidenceAssessment !== null && !EVIDENCE_ASSESSMENTS.includes(l.evidenceAssessment)) throw new DomainError("invalid_input", "Đánh giá minh chứng không hợp lệ");
    const cited = [...new Set(l.evidenceFileIds)];
    if (cited.length > MAX_FILES || cited.some((id) => !evidence.has(id))) {
      throw new DomainError("evidence_not_in_submission", "Chỉ viện dẫn được minh chứng của Phiên bản nộp mới nhất");
    }
    byId.set(l.criterionId, { criterionId: l.criterionId, levelId: l.levelId, basis: text(l.basis), evidenceFileIds: cited, evidenceAssessment: l.evidenceAssessment });
  }
  const attachmentFileIds = [...new Set(input.attachmentFileIds)];
  if (attachmentFileIds.length > MAX_FILES) throw new DomainError("invalid_input", "Quá nhiều tệp đính kèm");
  for (const id of attachmentFileIds) {
    // A file the nháp already holds stays, whoever uploaded it; a new one is the actor's own upload.
    if (kept.includes(id)) continue;
    await ownUpload(tx, actor, id, "advisory_attachment", () => new DomainError("file_required", "Tải lên tệp đính kèm của Tổ tư vấn"));
  }
  const order = rows.criteria.map((c) => c.id);
  const lines = [...byId.values()].sort((a, b) => order.indexOf(a.criterionId) - order.indexOf(b.criterionId));
  return { lines, summary: text(input.summary), notes: text(input.notes), attachmentFileIds };
}

/** The nháp joined with the Bộ tiêu chí: lines in sheet order, the estimate and what phát hành still lacks. */
async function compose(tx: Tx, dossier: Dossier, draft: Pick<AdvisoryReportDraft, "lines">, latest: Submission | null) {
  const rows = await setOf(tx, dossier);
  const thresholds = await tx.criteriaVersions.thresholds(dossier.criteriaVersionId);
  const set = assembleSet(rows);
  const lineOf = new Map(draft.lines.map((l) => [l.criterionId, l]));
  const submittedOf = new Map((latest?.snapshot.criteria ?? []).map((c) => [c.criterionId, c]));
  const fileName = new Map((latest?.snapshot.evidence ?? []).map((e) => [e.fileId, e.fileName]));
  const criteria = set.parts.flatMap((part) =>
    criteriaOf(part).map((c): AdvisoryCriterionView => {
      const line = lineOf.get(c.id) ?? blankLine(c.id);
      const sub = submittedOf.get(c.id);
      return {
        criterionId: c.id,
        code: c.code,
        name: c.name,
        partCode: part.code,
        maxPoints: c.maxPoints,
        levels: c.levels.map((l) => ({ id: l.id, description: l.description, points: l.points })),
        submitted: {
          points: sub?.points ?? null,
          explanation: sub?.explanation ?? "",
          evidence: (sub?.evidenceFileIds ?? []).map((id) => ({ fileId: id, fileName: fileName.get(id) ?? "" })),
        },
        line: { ...line, points: c.levels.find((l) => l.id === line.levelId)?.points ?? null },
      };
    }),
  );
  const rank = rankStoredSet({ set, thresholds, scores: new Map(criteria.flatMap((c) => (c.line.points === null ? [] : [[c.criterionId, c.line.points] as const]))) });
  return {
    criteria,
    fileName,
    estimate: { parts: rank.parts.map((p) => ({ code: p.code, total: p.total })), total: rank.total, star: rank.star },
    missing: criteria.filter((c) => c.line.levelId === null || c.line.basis === "").map((c) => c.code),
  };
}

const emptyDraft = (dossierId: string): AdvisoryReportDraft => ({
  dossierId,
  version: 0,
  summary: "",
  notes: "",
  attachmentFileIds: [],
  lines: [],
  updatedAt: new Date(0),
  updatedBy: "",
});

async function userRef(tx: Tx, userId: string) {
  return { userId, fullName: (await tx.users.findById(userId))?.fullName ?? "" };
}

async function versionSummaries(tx: Tx, versions: AdvisoryReportVersion[]): Promise<AdvisoryReportVersionSummary[]> {
  const out: AdvisoryReportVersionSummary[] = [];
  for (const v of versions) out.push({ id: v.id, number: v.number, issuedAt: v.issuedAt, issuedBy: await userRef(tx, v.issuedBy), reason: v.reason });
  return out;
}

/** Stories 43 to 47, 49: the nháp of a hồ sơ the reader is Phân công on as Thành viên Tổ tư vấn, with what it reviews. */
export function advisoryReport(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<AdvisoryReportWorkspace> => {
    authorize(actor, "dossier.advisory_report.draft");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const latest = await tx.dossiers.latestSubmission(dossier.id);
      const draft = (await tx.advisoryReports.draft(dossier.id)) ?? emptyDraft(dossier.id);
      const composed = await compose(tx, dossier, draft, latest);
      const attachments = [];
      for (const id of draft.attachmentFileIds) {
        const file = await tx.files.findById(id);
        attachments.push({ fileId: id, fileName: file?.fileName ?? "", status: file?.status ?? "blocked" });
      }
      const council = dossier.councilId ? await tx.councils.findById(dossier.councilId) : null;
      return {
        dossierId: dossier.id,
        dossierVersion: dossier.version,
        state: dossier.state,
        draftVersion: draft.version,
        criteria: composed.criteria,
        summary: draft.summary,
        notes: draft.notes,
        attachments,
        estimate: composed.estimate,
        missing: composed.missing,
        isLeader: council?.leaderUserId === actor.userId,
        updatedAt: draft.version === 0 ? null : draft.updatedAt,
        updatedBy: draft.version === 0 ? null : await userRef(tx, draft.updatedBy),
        versions: await versionSummaries(tx, await tx.advisoryReports.versions(dossier.id)),
      };
    });
  };
}

/** Stories 44 to 49: saves the whole nháp; a save from an older nháp version than the stored one is refused (story 50). */
export function saveAdvisoryDraft(deps: CoreDeps) {
  return async (actor: Actor, input: AdvisoryReportContent & { dossierId: string; draftVersion: number }): Promise<{ draftVersion: number }> => {
    authorize(actor, "dossier.advisory_report.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const stored = (await tx.advisoryReports.draft(before.id)) ?? emptyDraft(before.id);
      // The nháp's own version is the lock between colleagues; the hồ sơ row lock queues them.
      const after = await transition(deps, tx, actor, before, { action: "dossier.advisory_report.edit", expectedVersion: before.version, metadata: { draftVersion: stored.version + 1 } });
      if (input.draftVersion !== stored.version) throw versionConflict();
      const content = await validContent(tx, actor, await setOf(tx, before), await tx.dossiers.latestSubmission(before.id), stored.attachmentFileIds, input);
      const draft: AdvisoryReportDraft = { dossierId: before.id, version: stored.version + 1, ...content, updatedAt: after.updatedAt, updatedBy: actor.userId };
      if (!(await tx.advisoryReports.saveDraft(draft, stored.version))) throw versionConflict();
      return { draftVersion: draft.version };
    });
  };
}

/** The Tổ trưởng of the hồ sơ's Hội đồng now, still holding a Phân vai Thành viên Tổ tư vấn in force on it (spec #49 "Hội đồng"). */
async function assertLeader(tx: Tx, actor: UserActor, dossier: Dossier, now: Date) {
  const council = dossier.councilId ? await tx.councils.findById(dossier.councilId) : null;
  const holds = council ? (await tx.roleAssignments.listForScope("advisory_member", "council", council.id)).some((a) => a.userId === actor.userId && isAssignmentActive(a, now)) : false;
  if (!council || council.leaderUserId !== actor.userId || !holds) {
    throw new DomainError(forbidden().code, "Chỉ Tổ trưởng Tổ tư vấn của hội đồng mới phát hành được Báo cáo Tổ tư vấn");
  }
}

/** Writes phiên bản N from the nháp as it now is, refused while a Tiêu chí lacks Điểm đề xuất or căn cứ (story 57). */
async function issue(deps: CoreDeps, tx: Tx, actor: UserActor, dossier: Dossier, draft: AdvisoryReportDraft, reason: string | null, now: Date) {
  const latest = await tx.dossiers.latestSubmission(dossier.id);
  const composed = await compose(tx, dossier, draft, latest);
  if (composed.missing.length > 0) throw new AdvisoryReportIncomplete(composed.missing);
  const attachments = [];
  for (const id of draft.attachmentFileIds) attachments.push({ fileId: id, fileName: (await tx.files.findById(id))?.fileName ?? "" });
  const snapshot: AdvisoryReportSnapshot = {
    criteriaVersionId: dossier.criteriaVersionId,
    criteriaSetId: dossier.criteriaSetId,
    submissionNumber: latest?.number ?? null,
    lines: composed.criteria.map((c) => {
      const level = c.levels.find((l) => l.id === c.line.levelId)!;
      return {
        criterionId: c.criterionId,
        code: c.code,
        name: c.name,
        partCode: c.partCode,
        maxPoints: c.maxPoints,
        levelId: level.id,
        levelDescription: level.description,
        points: level.points,
        basis: c.line.basis,
        evidence: c.line.evidenceFileIds.map((id) => ({ fileId: id, fileName: composed.fileName.get(id) ?? "" })),
        evidenceAssessment: c.line.evidenceAssessment,
      };
    }),
    summary: draft.summary,
    notes: draft.notes,
    attachments,
    estimate: composed.estimate as AdvisoryReportSnapshot["estimate"],
  };
  const number = (await tx.advisoryReports.versions(dossier.id)).length + 1;
  const version: AdvisoryReportVersion = { id: deps.ids.next(), dossierId: dossier.id, number, snapshot, issuedBy: actor.userId, issuedAt: now, reason };
  await tx.advisoryReports.insertVersion(version);
  // The reason stays off the timeline the Chủ thể reads; the audit keeps it with the phiên bản.
  await tx.audit.append(
    auditEntry(actor, deps.ids.next(), now, {
      action: "scoring.advisory_report.issued",
      targetType: "dossier",
      targetId: dossier.id,
      after: { versionId: version.id, number },
      metadata: { draftVersion: draft.version, total: snapshot.estimate.total, star: snapshot.estimate.star, ...(reason ? { reason } : {}) },
    }),
  );
  return number;
}

/** Stories 56 to 59: the Tổ trưởng issues the nháp as phiên bản 1; the hồ sơ moves to Đã có báo cáo Tổ tư vấn. */
export function issueAdvisoryReport(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<{ version: number; number: number }> => {
    authorize(actor, "dossier.advisory_report.write");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const before = await lockDossier(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, { action: "dossier.advisory_report.issue", expectedVersion: input.expectedVersion, metadata: { number: 1 } });
      await assertLeader(tx, actor, before, now);
      const draft = (await tx.advisoryReports.draft(before.id)) ?? emptyDraft(before.id);
      const number = await issue(deps, tx, actor, before, draft, null, now);
      return { version: after.version, number };
    });
  };
}

/**
 * Stories 60, 61: phiên bản N+1, from the content the Tổ trưởng edited starting from phiên bản N, with a reason;
 * while the hồ sơ is Đã có báo cáo Tổ tư vấn, Thành viên xem xét or Thành viên xác nhận, never once Đã chốt điểm.
 * The nháp takes that content too, so it always holds what was issued last.
 */
export function reissueAdvisoryReport(deps: CoreDeps) {
  return async (actor: Actor, input: AdvisoryReportContent & { dossierId: string; expectedVersion: number; reason: string }): Promise<{ version: number; number: number }> => {
    authorize(actor, "dossier.advisory_report.write");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason === "") throw new DomainError("reason_required", "Ghi lý do phát hành phiên bản mới");
    if (reason.length > 2000) throw new DomainError("field_too_long", "Lý do quá dài");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const before = await lockDossier(tx, actor, input.dossierId);
      const versions = await tx.advisoryReports.versions(before.id);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.advisory_report.reissue",
        expectedVersion: input.expectedVersion,
        metadata: { number: versions.length + 1 },
      });
      await assertLeader(tx, actor, before, now);
      if (versions.length === 0) throw new DomainError("no_issued_version", "Hồ sơ chưa có Báo cáo Tổ tư vấn đã phát hành");
      const stored = (await tx.advisoryReports.draft(before.id)) ?? emptyDraft(before.id);
      const content = await validContent(tx, actor, await setOf(tx, before), await tx.dossiers.latestSubmission(before.id), stored.attachmentFileIds, input);
      const draft: AdvisoryReportDraft = { dossierId: before.id, version: stored.version + 1, ...content, updatedAt: now, updatedBy: actor.userId };
      const number = await issue(deps, tx, actor, before, draft, reason, now);
      if (!(await tx.advisoryReports.saveDraft(draft, stored.version))) throw versionConflict();
      return { version: after.version, number };
    });
  };
}

export interface AdvisoryReportVersionView extends AdvisoryReportVersionSummary {
  report: AdvisoryReportSnapshot;
}

/** Story 63: every issued phiên bản of a hồ sơ within the reader's Phạm vi, oldest first; never the nháp. */
export function advisoryReportVersions(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<AdvisoryReportVersionView[]> => {
    authorize(actor, "dossier.advisory_report.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const versions = await tx.advisoryReports.versions(dossier.id);
      const summaries = await versionSummaries(tx, versions);
      return versions.map((v, i) => ({ ...summaries[i]!, report: v.snapshot }));
    });
  };
}

const fileNotFound = () => new DomainError("not_found", "Không tìm thấy tệp");

/**
 * Story 43, 48: a short-lived link to a minh chứng of the newest Phiên bản nộp, or to a tệp đính kèm of the Báo
 * cáo Tổ tư vấn, for a Vai trò hội đồng whose Phạm vi covers the hồ sơ. Attachments of the nháp are for the Tổ tư
 * vấn only; anyone else reaches only those of an issued phiên bản.
 */
export function downloadAdvisoryFile(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; fileId: string }): Promise<{ url: string; expiresAt: Date; fileName: string }> => {
    authorize(actor, "dossier.advisory_report.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      assertIdShape(input.fileId, fileNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const latest = await tx.dossiers.latestSubmission(dossier.id);
      const issued = (await tx.advisoryReports.versions(dossier.id)).flatMap((v) => v.snapshot.attachments.map((a) => a.fileId));
      const drafted = actor.activeRole === "advisory_member" ? ((await tx.advisoryReports.draft(dossier.id))?.attachmentFileIds ?? []) : [];
      const reachable = new Set([...(latest?.snapshot.evidence.map((e) => e.fileId) ?? []), ...issued, ...drafted]);
      const file = reachable.has(input.fileId) ? await tx.files.findById(input.fileId) : null;
      if (!file) throw fileNotFound();
      if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa sẵn sàng để tải xuống");
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), { action: "file.download_issued", targetType: "file", targetId: file.id, metadata: { dossierId: dossier.id } }),
      );
      return { url: get.url, expiresAt: get.expiresAt, fileName: file.fileName };
    });
  };
}
