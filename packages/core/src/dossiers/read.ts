import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { isExpired } from "../entities/legal";
import { dossierNotFound, type Dossier, type DossierEvent, type EvidenceFile, type Submission } from "./model";

export interface DossierSummary extends Dossier {
  criteriaSet: { id: string; code: string; name: string };
  criteriaVersion: { id: string; legalBasis: string };
}

export interface DossierView extends Omit<DossierSummary, "copiedFrom"> {
  /** The hồ sơ this one was copied from, as the Chủ thể knows it (story 27). */
  copiedFrom: { id: string; productName: string } | null;
  evidence: EvidenceFile[];
  /** The newest Phiên bản nộp, which xã, tỉnh and hội đồng work on; null before the first nộp. */
  latestSubmission: { id: string; number: number; submittedAt: Date } | null;
  /** What needs a second look without changing the state of the hồ sơ. */
  flags: DossierFlag[];
}

/**
 * Story 45, ticket #36: a giấy tờ pháp lý of the newest Phiên bản nộp that has expired since. The hồ sơ
 * keeps its state; the flag only tells the Cán bộ xã to look again.
 */
export interface DossierFlag {
  kind: "legal_document_expired";
  typeCode: string;
  typeName: string;
  validUntil: string;
}

function flagsOf(latest: Submission | null, now: Date): DossierFlag[] {
  if (!latest) return [];
  return latest.snapshot.legalDocuments
    .filter((d) => isExpired(d, now))
    .map((d) => ({ kind: "legal_document_expired", typeCode: d.typeCode, typeName: d.typeName, validUntil: d.validUntil! }));
}

async function summarize(tx: Tx, dossiers: Dossier[]): Promise<DossierSummary[]> {
  const versions = new Map((await tx.criteriaVersions.findByIds([...new Set(dossiers.map((d) => d.criteriaVersionId))])).map((v) => [v.id, v]));
  const sets = new Map<string, { id: string; code: string; name: string }>();
  for (const id of new Set(dossiers.map((d) => d.criteriaSetId))) {
    const found = await tx.criteriaVersions.findNode("set", id);
    if (found) sets.set(id, { id, code: found.row.code, name: found.row.name });
  }
  return dossiers.map((d) => ({
    ...d,
    criteriaSet: sets.get(d.criteriaSetId) ?? { id: d.criteriaSetId, code: "", name: "" },
    criteriaVersion: { id: d.criteriaVersionId, legalBasis: versions.get(d.criteriaVersionId)?.legalBasis ?? "" },
  }));
}

/** The hồ sơ within the reader's Phạm vi; any other is not found, whether or not it exists (story 80). */
export function getDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<DossierView> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const [summary] = await summarize(tx, [dossier]);
      // The origin is shown only while the reader still sees it.
      const origin = dossier.copiedFrom ? await tx.dossiers.findById(scope, dossier.copiedFrom) : null;
      const latest = await tx.dossiers.latestSubmission(dossier.id);
      return {
        ...summary!,
        copiedFrom: origin && { id: origin.id, productName: origin.productName },
        evidence: await tx.dossiers.evidence(dossier.id),
        latestSubmission: latest ? { id: latest.id, number: latest.number, submittedAt: latest.submittedAt } : null,
        flags: flagsOf(latest, deps.clock.now()),
      };
    });
  };
}

/** Every hồ sơ within the reader's Phạm vi, newest first. */
export function listDossiers(deps: CoreDeps) {
  return async (actor: Actor): Promise<DossierSummary[]> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => summarize(tx, await tx.dossiers.list(scope)));
  };
}

/** Story 34: the dòng thời gian of a hồ sơ within the reader's Phạm vi, oldest first. */
export function dossierTimeline(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<DossierEvent[]> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      if (!(await tx.dossiers.findById(scope, input.dossierId))) throw dossierNotFound();
      return tx.dossiers.events(scope, input.dossierId);
    });
  };
}
