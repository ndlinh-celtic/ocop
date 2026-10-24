import { authorize } from "../identity/policy";
import { ROLES, SCOPE_OF_ROLE } from "../identity/roles";
import { dataScopeOf, type DataScope } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape, isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { isExpired } from "../entities/legal";
import type { Entity } from "../entities/model";
import { DOSSIER_STATES, dossierNotFound, isAwaitingNextRound, rejectionOf, type Dossier, type DossierRejection, type DossierEvent, type DossierListFilter, type DossierState, type EvidenceFile, type Submission } from "./model";

export interface DossierSummary extends Dossier {
  criteriaSet: { id: string; code: string; name: string };
  criteriaVersion: { id: string; legalBasis: string };
  entity: { id: string; name: string };
  /** The Nhóm sản phẩm of its Bộ tiêu chí (story 13). */
  productGroup: { id: string; name: string } | null;
  ward: { id: string; name: string } | null;
  round: { id: string; name: string } | null;
  /** When it was last nộp or nộp lại; null for a Nháp never submitted. */
  submittedAt: Date | null;
  handler: { userId: string; fullName: string } | null;
  /** Story 68: Chờ đợt sau, derived from the Hạn gửi tỉnh of its đợt at the time of reading. */
  awaitingNextRound: boolean;
}

/**
 * What a list of hồ sơ may be narrowed to (story 39): Chờ tiếp nhận at the xã, của tôi, Chờ đợt sau, or
 * Chờ tiếp nhận at the province (#51 story 13); and to one state, đợt, xã or Nhóm sản phẩm.
 */
export interface DossierListInput {
  filter?: "awaiting_receipt" | "mine" | "awaiting_next_round" | "awaiting_province_receipt" | "advisory_return_requested";
  state?: DossierState;
  roundId?: string;
  wardId?: string;
  productGroupId?: string;
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
  const groups = new Map<string, { id: string; name: string } | null>();
  for (const id of new Set(dossiers.map((d) => d.criteriaSetId))) groups.set(id, await productGroupOf(tx, id));
  const wards = dossiers.some((d) => d.wardId) ? new Map((await tx.wards.list()).map((w) => [w.id, w.name])) : new Map<string, string>();
  const rounds = new Map<string, { name: string; forwardingDeadline: Date }>();
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
    productGroup: groups.get(d.criteriaSetId) ?? null,
    ward: d.wardId ? { id: d.wardId, name: wards.get(d.wardId) ?? "" } : null,
    round: d.roundId ? { id: d.roundId, name: rounds.get(d.roundId)?.name ?? "" } : null,
    submittedAt: submittedAt.get(d.id) ?? null,
    handler: d.handlerUserId ? { userId: d.handlerUserId, fullName: handlers.get(d.handlerUserId) ?? "" } : null,
    awaitingNextRound: isAwaitingNextRound(d, (d.roundId && rounds.get(d.roundId)) || null, now),
  }));
}

async function productGroupOf(tx: Tx, setId: string) {
  const set = (await tx.criteriaVersions.findNode("set", setId))?.row;
  const subgroup = set && (await tx.criteriaVersions.findNode("subgroup", set.subgroupId))?.row;
  const group = subgroup && (await tx.criteriaVersions.findNode("productGroup", subgroup.productGroupId))?.row;
  return group ? { id: group.id, name: group.name } : null;
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
      ...(input.filter === "awaiting_province_receipt" ? { awaitingProvinceReceipt: true } : {}),
      ...(input.filter === "advisory_return_requested" ? { advisoryReturnRequested: true } : {}),
    };
    // An id that cannot exist narrows to nothing rather than reaching the database.
    for (const key of ["roundId", "wardId", "productGroupId"] as const) {
      const id = input[key];
      if (id === undefined || id === "") continue;
      if (!isUuid(id)) return [];
      filter[key] = id;
    }
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
      const events = await tx.dossiers.events(scope, input.dossierId);
      // Spec #49 (story 137): the Chủ thể sees the Hội đồng's milestones, never who in the Hội đồng took them.
      if (scope.kind !== "entity") return events;
      return events.map((e) => (e.actorRole !== null && COUNCIL_ROLES.has(e.actorRole) ? { ...e, actorUserId: null, actorRole: null } : e));
    });
  };
}

const COUNCIL_ROLES: ReadonlySet<string> = new Set(ROLES.filter((r) => SCOPE_OF_ROLE[r] === "council"));

/** One cell of the số liệu tổng hợp: how many hồ sơ of a xã are in a state. */
export interface DossierOverviewRow {
  wardId: string;
  wardName: string;
  state: DossierState;
  count: number;
}

/**
 * Story 79: for the Cán bộ Sở, the hồ sơ submitted but not yet at the province, counted by xã and state,
 * optionally within one đợt. Counts only, so no Chủ thể data or hồ sơ row is read out.
 */
export function provinceOverview(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId?: string } = {}): Promise<DossierOverviewRow[]> => {
    authorize(actor, "dossier.overview");
    return deps.uow.run(async (tx) => {
      const roundId = input.roundId && isUuid(input.roundId) ? input.roundId : undefined;
      if (input.roundId && !roundId) return [];
      const wards = new Map((await tx.wards.list()).map((w) => [w.id, w.name]));
      const rows = await tx.dossiers.countNotForwarded(roundId ? { roundId } : {});
      return rows
        .map((r) => ({ wardId: r.wardId, wardName: wards.get(r.wardId) ?? "", state: r.state, count: r.count }))
        .sort((a, b) => a.wardName.localeCompare(b.wardName, "vi") || DOSSIER_STATES.indexOf(a.state) - DOSSIER_STATES.indexOf(b.state));
    });
  };
}
