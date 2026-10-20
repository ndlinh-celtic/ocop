import { authorize } from "../identity/policy";
import { dataScopeOf, type DataScope } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { isExpired } from "../entities/legal";
import type { Entity } from "../entities/model";
import { DOSSIER_STATES, dossierNotFound, isAwaitingNextRound, rejectionOf, type Dossier, type DossierRejection, type DossierEvent, type DossierListFilter, type DossierState, type EvidenceFile, type Submission } from "./model";

export interface DossierSummary extends Dossier {
  criteriaSet: { id: string; code: string; name: string };
  criteriaVersion: { id: string; legalBasis: string };
  entity: { id: string; name: string };
  /** When it was last nộp or nộp lại; null for a Nháp never submitted. */
  submittedAt: Date | null;
  handler: { userId: string; fullName: string } | null;
  /** Story 68: Chờ đợt sau, derived from the Hạn gửi tỉnh of its đợt at the time of reading. */
  awaitingNextRound: boolean;
}

/** What a list of hồ sơ may be narrowed to (story 39): Chờ tiếp nhận, của tôi, or one state. */
export interface DossierListInput {
  filter?: "awaiting_receipt" | "mine" | "awaiting_next_round";
  state?: DossierState;
}

export interface DossierView extends Omit<DossierSummary, "copiedFrom"> {
  /** The hồ sơ this one was copied from, as the Chủ thể knows it (story 27). */
  copiedFrom: { id: string; productName: string } | null;
  evidence: EvidenceFile[];
  /** The newest Phiên bản nộp, which xã, tỉnh and hội đồng work on; null before the first nộp. */
  latestSubmission: { id: string; number: number; submittedAt: Date } | null;
  /** What needs a second look without changing the state of the hồ sơ. */
  flags: DossierFlag[];
  /** Story 46: the Tiêu chí of the newest Phiên bản nộp with no minh chứng tied to them, in sheet order. */
  criteriaWithoutEvidence: { criterionId: string; code: string; name: string }[];
  /** Why it is Không đạt sơ bộ (story 35); null in any other state. */
  rejection: DossierRejection | null;
}

/** The thông tin Chủ thể compared with the Phiên bản nộp (story 45). */
export const ENTITY_FIELDS = ["name", "taxCode", "address", "representativeName", "phone", "wardId"] as const;
export type EntityField = (typeof ENTITY_FIELDS)[number];

/**
 * Story 45: what changed since the newest Phiên bản nộp. A giấy tờ pháp lý in it that has expired since
 * (#36), or thông tin Chủ thể that now differs from its bản chụp. The hồ sơ keeps its state; the flag
 * only tells the Cán bộ xã to look again.
 */
export type DossierFlag =
  | { kind: "legal_document_expired"; typeCode: string; typeName: string; validUntil: string }
  | { kind: "entity_changed"; fields: EntityField[] };

function flagsOf(latest: Submission | null, entity: Entity | null, now: Date): DossierFlag[] {
  if (!latest) return [];
  const flags: DossierFlag[] = latest.snapshot.legalDocuments
    .filter((d) => isExpired(d, now))
    .map((d) => ({ kind: "legal_document_expired", typeCode: d.typeCode, typeName: d.typeName, validUntil: d.validUntil! }));
  const changed = entity ? ENTITY_FIELDS.filter((field) => latest.snapshot.entity[field] !== entity[field]) : [];
  if (changed.length > 0) flags.push({ kind: "entity_changed", fields: changed });
  return flags;
}

async function summarize(tx: Tx, scope: DataScope, dossiers: Dossier[], now: Date): Promise<DossierSummary[]> {
  const versions = new Map((await tx.criteriaVersions.findByIds([...new Set(dossiers.map((d) => d.criteriaVersionId))])).map((v) => [v.id, v]));
  const sets = new Map<string, { id: string; code: string; name: string }>();
  for (const id of new Set(dossiers.map((d) => d.criteriaSetId))) {
    const found = await tx.criteriaVersions.findNode("set", id);
    if (found) sets.set(id, { id, code: found.row.code, name: found.row.name });
  }
  const entities = new Map((await tx.entities.list(scope)).map((e) => [e.id, e.name]));
  const submittedAt = await tx.dossiers.lastSubmittedAt(dossiers.map((d) => d.id));
  const rounds = new Map<string, { forwardingDeadline: Date }>();
  for (const id of new Set(dossiers.flatMap((d) => (d.roundId ? [d.roundId] : [])))) {
    const found = await tx.rounds.findById(id);
    if (found) rounds.set(id, found);
  }
  const handlers = new Map<string, string>();
  for (const id of new Set(dossiers.flatMap((d) => (d.handlerUserId ? [d.handlerUserId] : [])))) {
    handlers.set(id, (await tx.users.findById(id))?.fullName ?? "");
  }
  return dossiers.map((d) => ({
    ...d,
    criteriaSet: sets.get(d.criteriaSetId) ?? { id: d.criteriaSetId, code: "", name: "" },
    criteriaVersion: { id: d.criteriaVersionId, legalBasis: versions.get(d.criteriaVersionId)?.legalBasis ?? "" },
    entity: { id: d.entityId, name: entities.get(d.entityId) ?? "" },
    submittedAt: submittedAt.get(d.id) ?? null,
    handler: d.handlerUserId ? { userId: d.handlerUserId, fullName: handlers.get(d.handlerUserId) ?? "" } : null,
    awaitingNextRound: isAwaitingNextRound(d, (d.roundId && rounds.get(d.roundId)) || null, now),
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
      const [summary] = await summarize(tx, scope, [dossier], deps.clock.now());
      // The origin is shown only while the reader still sees it.
      const origin = dossier.copiedFrom ? await tx.dossiers.findById(scope, dossier.copiedFrom) : null;
      const latest = await tx.dossiers.latestSubmission(dossier.id);
      const entity = await tx.entities.findById(scope, dossier.entityId);
      return {
        ...summary!,
        copiedFrom: origin && { id: origin.id, productName: origin.productName },
        evidence: await tx.dossiers.evidence(dossier.id),
        latestSubmission: latest ? { id: latest.id, number: latest.number, submittedAt: latest.submittedAt } : null,
        flags: flagsOf(latest, entity, deps.clock.now()),
        criteriaWithoutEvidence: (latest?.snapshot.criteria ?? [])
          .filter((c) => c.evidenceFileIds.length === 0)
          .map((c) => ({ criterionId: c.criterionId, code: c.code, name: c.name })),
        rejection: dossier.state === "rejected_preliminary" ? rejectionOf(await tx.dossiers.events(scope, dossier.id)) : null,
      };
    });
  };
}

/** Every hồ sơ within the reader's Phạm vi, newest first, narrowed as asked (story 39). */
export function listDossiers(deps: CoreDeps) {
  return async (actor: Actor, input: DossierListInput = {}): Promise<DossierSummary[]> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    const filter: DossierListFilter = {
      ...(input.state && (DOSSIER_STATES as readonly string[]).includes(input.state) ? { state: input.state } : {}),
      ...(input.filter === "awaiting_receipt" ? { awaitingReceipt: true } : {}),
      ...(input.filter === "mine" ? { handlerUserId: actor.userId } : {}),
    };
    const now = deps.clock.now();
    if (input.filter === "awaiting_next_round") filter.awaitingNextRoundAt = now;
    return deps.uow.run(async (tx) => summarize(tx, scope, await tx.dossiers.list(scope, filter), now));
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
