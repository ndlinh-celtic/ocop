import { assembleSet, type CriteriaSetDetail, type StoredCriterion } from "../criteria/detail";
import { criteriaOf, type RankThresholds } from "../criteria/model";
import { rankStoredSet, type StoredStarRank, type StoredUnmetMinimumStar } from "../criteria/star-rank";
import type { SetRows } from "../criteria/version";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { lockDossier } from "./edit";
import { dossierNotFound, type CriterionEntry, type Dossier, type EvidenceFile } from "./model";
import { transition } from "./transition";

/*
 * L02 CT-05, CT-06 (stories 20 to 25): on the bản làm việc of a hồ sơ the Chủ thể ties each file of the
 * kho minh chứng to one or more Tiêu chí, writes a giải trình per Tiêu chí, and picks one Mức điểm per
 * Tiêu chí to see what Hạng sao the hồ sơ would get. The estimate is the star rank of `criteria`, only
 * for reference: the official score comes from the hội đồng.
 */

const MAX_EXPLANATION = 10_000;

/** The Bộ tiêu chí of the hồ sơ, fixed at creation in a published Phiên bản tiêu chí. */
async function setOf(tx: Tx, dossier: Dossier): Promise<SetRows> {
  const found = await tx.criteriaVersions.findSet(dossier.criteriaSetId);
  if (!found) throw new Error(`criteria set ${dossier.criteriaSetId} of dossier ${dossier.id} is missing`);
  return found.rows;
}

const criterionNotInSet = () => new DomainError("criterion_not_in_set", "Tiêu chí không thuộc Bộ tiêu chí của hồ sơ");

function assertCriterion(rows: SetRows, criterionId: unknown): asserts criterionId is string {
  if (!isUuid(criterionId) || !rows.criteria.some((c) => c.id === criterionId)) throw criterionNotInSet();
}

/** The entry of a Tiêu chí as stored, or a blank one if the Chủ thể has not touched it yet. */
async function entryOf(tx: Tx, dossierId: string, criterionId: string): Promise<CriterionEntry | undefined> {
  return (await tx.dossiers.criterionEntries(dossierId)).find((e) => e.criterionId === criterionId);
}

interface Edit {
  dossierId: string;
  expectedVersion: number;
}

/**
 * Story 20, 22: ties a file of the kho minh chứng to these Tiêu chí, replacing what it was tied to (an
 * empty list unties it). Only a file the scan found clean can be tied.
 */
export function linkEvidence(deps: CoreDeps) {
  return async (actor: Actor, input: Edit & { fileId: string; criterionIds: readonly string[] }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const file = (await tx.dossiers.evidence(before.id)).find((e) => e.fileId === input.fileId);
      if (!file) throw evidenceNotInKho();
      if (file.status !== "clean") throw new DomainError("file_not_clean", "Tệp chưa được quét virus sạch nên chưa gắn được vào tiêu chí");
      const rows = await setOf(tx, before);
      const criterionIds = [...new Set(input.criterionIds)];
      for (const id of criterionIds) assertCriterion(rows, id);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.evidence.link",
        expectedVersion: input.expectedVersion,
        metadata: { fileId: file.fileId, criterionIds },
      });
      await tx.dossiers.setEvidenceLinks(after.id, file.fileId, criterionIds);
      return { version: after.version };
    });
  };
}

const evidenceNotInKho = () => new DomainError("evidence_not_found", "Tệp không có trong kho minh chứng của hồ sơ");

/**
 * Takes a file out of the kho minh chứng of the bản làm việc, with its ties to Tiêu chí. The file itself
 * stays: other hồ sơ, or a Phiên bản nộp (#36), may still refer to it.
 */
export function removeEvidenceFile(deps: CoreDeps) {
  return async (actor: Actor, input: Edit & { fileId: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      if (!(await tx.dossiers.evidence(before.id)).some((e) => e.fileId === input.fileId)) throw evidenceNotInKho();
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.evidence.remove",
        expectedVersion: input.expectedVersion,
        metadata: { fileId: input.fileId },
      });
      await tx.dossiers.removeEvidence(after.id, input.fileId);
      return { version: after.version };
    });
  };
}

/** Story 23, 25: picks the Mức điểm of a Tiêu chí for tự chấm thử (null clears it), with or without minh chứng. */
export function selfScore(deps: CoreDeps) {
  return async (actor: Actor, input: Edit & { criterionId: string; levelId: string | null }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const rows = await setOf(tx, before);
      assertCriterion(rows, input.criterionId);
      const level = input.levelId === null ? null : rows.levels.find((l) => l.id === input.levelId && l.criterionId === input.criterionId);
      if (level === undefined) throw new DomainError("level_not_in_criterion", "Mức điểm đã chọn không thuộc tiêu chí này");
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.self_score",
        expectedVersion: input.expectedVersion,
        metadata: { criterionId: input.criterionId, levelId: level?.id ?? null, points: level?.points ?? null },
      });
      const current = await entryOf(tx, after.id, input.criterionId);
      await tx.dossiers.saveCriterionEntry({
        dossierId: after.id,
        criterionId: input.criterionId,
        scoreLevelId: level?.id ?? null,
        explanation: current?.explanation ?? "",
        updatedAt: after.updatedAt,
      });
      return { version: after.version };
    });
  };
}

/** Story 21: the giải trình of a Tiêu chí, saved as the editor autosaves. */
export function explainCriterion(deps: CoreDeps) {
  return async (actor: Actor, input: Edit & { criterionId: string; explanation: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    if (typeof input.explanation !== "string" || input.explanation.length > MAX_EXPLANATION) throw new DomainError("field_too_long", "Nội dung quá dài");
    const explanation = input.explanation.trim();
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      assertCriterion(await setOf(tx, before), input.criterionId);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.explain",
        expectedVersion: input.expectedVersion,
        metadata: { criterionId: input.criterionId },
      });
      const current = await entryOf(tx, after.id, input.criterionId);
      await tx.dossiers.saveCriterionEntry({
        dossierId: after.id,
        criterionId: input.criterionId,
        scoreLevelId: current?.scoreLevelId ?? null,
        explanation,
        updatedAt: after.updatedAt,
      });
      return { version: after.version };
    });
  };
}

export interface CriterionAssessment {
  criterionId: string;
  code: string;
  name: string;
  /** Phần A, B or C. */
  partCode: string;
  maxPoints: number;
  /** The Mức điểm picked when tự chấm thử, null until picked. */
  levelId: string | null;
  points: number | null;
  explanation: string;
  /** Files tied to the Tiêu chí; empty means "chưa có minh chứng" (story 25), which never blocks tự chấm. */
  evidence: { fileId: string; fileName: string }[];
}

export interface SelfAssessment {
  dossierId: string;
  version: number;
  set: CriteriaSetDetail;
  thresholds: RankThresholds;
  /** Every Tiêu chí of the Bộ tiêu chí in sheet order. */
  criteria: CriterionAssessment[];
  /** The kho minh chứng, each file with the Tiêu chí it is tied to. */
  files: (EvidenceFile & { criterionIds: string[] })[];
  /** Tổng Phần A/B/C, tổng điểm and Hạng sao ước lượng; a Tiêu chí not yet scored counts 0. For reference only. */
  estimate: StoredStarRank;
  /** The Sao tối thiểu the hồ sơ misses for the next Hạng sao up: the Tiêu chí blocking it (story 23). */
  blocking: StoredUnmetMinimumStar[];
  /** How many Tiêu chí still have no Mức điểm. */
  unscored: number;
}

/** Story 20 to 25: the minh chứng, giải trình and tự chấm thử of a hồ sơ within the reader's Phạm vi, with the estimate. */
export function selfAssessment(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<SelfAssessment> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      // One connection per transaction: read in turn rather than in parallel.
      const rows = await setOf(tx, dossier);
      const thresholds = await tx.criteriaVersions.thresholds(dossier.criteriaVersionId);
      const files = await tx.dossiers.evidence(dossier.id);
      const links = await tx.dossiers.evidenceLinks(dossier.id);
      const entries = await tx.dossiers.criterionEntries(dossier.id);
      const set = assembleSet(rows);
      const entryOf = new Map(entries.map((e) => [e.criterionId, e]));
      const levelOf = new Map(rows.levels.map((l) => [l.id, l]));
      const fileOf = new Map(files.map((f) => [f.fileId, f]));
      const pointsOf = (c: StoredCriterion) => {
        const levelId = entryOf.get(c.id)?.scoreLevelId;
        return levelId ? (levelOf.get(levelId)?.points ?? null) : null;
      };

      const criteria = set.parts.flatMap((part) =>
        criteriaOf(part).map((c): CriterionAssessment => ({
          criterionId: c.id,
          code: c.code,
          name: c.name,
          partCode: part.code,
          maxPoints: c.maxPoints,
          levelId: entryOf.get(c.id)?.scoreLevelId ?? null,
          points: pointsOf(c),
          explanation: entryOf.get(c.id)?.explanation ?? "",
          evidence: links.filter((l) => l.criterionId === c.id).map((l) => ({ fileId: l.fileId, fileName: fileOf.get(l.fileId)?.fileName ?? "" })),
        })),
      );
      const scores = new Map(criteria.flatMap((c) => (c.points === null ? [] : [[c.criterionId, c.points] as const])));
      const estimate = rankStoredSet({ set, thresholds, scores });
      return {
        dossierId: dossier.id,
        version: dossier.version,
        set,
        thresholds,
        criteria,
        files: files.map((f) => ({ ...f, criterionIds: links.filter((l) => l.fileId === f.fileId).map((l) => l.criterionId) })),
        estimate,
        blocking: estimate.unmet.filter((u) => u.star === estimate.star + 1),
        unscored: criteria.filter((c) => c.levelId === null).length,
      };
    });
  };
}
