import { taxonomyTree, type TaxonomyGroup } from "../criteria/read";
import type { CriteriaVersion } from "../criteria/version";
import { legalStanding } from "../entities/legal";
import { entityNotFound } from "../entities/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { isPastSubmissionDeadline, vnDateOf, type Round } from "../rounds/model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { dossierNotFound, EMPTY_PRODUCT, type Dossier, type ProductInfo } from "./model";
import { recordCreation } from "./transition";

/**
 * The Phiên bản tiêu chí a new hồ sơ uses (story 16): that of the đợt Đang nhận nộp, or else the most
 * recently published one. A đợt past its Hạn nộp xã counts as closed, as in `currentOpenRound`.
 */
async function applicableVersion(tx: Tx, now: Date): Promise<{ version: CriteriaVersion; round: Round | null }> {
  const round = await tx.rounds.findOpen();
  if (round && !isPastSubmissionDeadline(round, now)) {
    const version = await tx.criteriaVersions.findById(round.criteriaVersionId);
    if (version) return { version, round };
  }
  const latest = (await tx.criteriaVersions.list({ status: "published" })).sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))[0];
  if (!latest) throw new DomainError("no_criteria_version", "Chưa có phiên bản tiêu chí nào được phát hành");
  return { version: latest, round: null };
}

export interface CreationOptions {
  version: Pick<CriteriaVersion, "id" | "legalBasis" | "issuedOn">;
  /** The đợt Đang nhận nộp whose version applies, if any. */
  round: { id: string; name: string } | null;
  productGroups: TaxonomyGroup[];
}

/** Story 15, 16: the Cây phân loại a Chủ thể picks its Bộ tiêu chí from, and the version it belongs to. */
export function creationOptions(deps: CoreDeps) {
  return async (actor: Actor): Promise<CreationOptions> => {
    authorize(actor, "dossier.create");
    return deps.uow.run(async (tx) => {
      const { version, round } = await applicableVersion(tx, deps.clock.now());
      return {
        version: { id: version.id, legalBasis: version.legalBasis, issuedOn: version.issuedOn },
        round: round && { id: round.id, name: round.name },
        productGroups: taxonomyTree(await tx.criteriaVersions.taxonomy(version.id)),
      };
    });
  };
}

/** The Chủ thể of the actor (or the one it acts for, L01 Nhập hộ), which must be Đã xác thực now to start a hồ sơ (story 15). */
async function verifiedEntity(tx: Tx, actor: UserActor, now: Date) {
  const scope = dataScopeOf(actor);
  if (scope.kind !== "entity" && scope.kind !== "on_behalf") throw entityNotFound();
  const entity = await tx.entities.findById(scope, scope.entityId);
  if (!entity) throw entityNotFound();
  const [types, documents] = await Promise.all([tx.legalDocuments.types(), tx.legalDocuments.list(scope, entity.id)]);
  if (!legalStanding(entity.kind, types, documents, now).verified) {
    throw new DomainError("entity_not_verified", "Chủ thể chưa Đã xác thực: cần đủ giấy tờ pháp lý bắt buộc còn hiệu lực trước khi tạo hồ sơ");
  }
  return entity;
}

const setNotApplicable = () => new DomainError("criteria_set_not_applicable", "Bộ tiêu chí không thuộc phiên bản tiêu chí đang áp dụng, hãy chọn lại");

/** Story 19, SO-03: the mã hồ sơ, HS-<năm>-<số>, the year in giờ Việt Nam and the số running within it. */
async function nextDossierCode(tx: Tx, now: Date): Promise<string> {
  const year = Number(vnDateOf(now).slice(0, 4));
  return `HS-${year}-${String(await tx.dossiers.nextCodeNumber(year)).padStart(4, "0")}`;
}

/**
 * A new Nháp on a Bộ tiêu chí of the applicable version, with what it is created from: its thông tin sản
 * phẩm and, for a copy, the hồ sơ it comes from and the files of its kho minh chứng, all on the record of
 * the creation.
 */
async function newDraft(
  deps: CoreDeps,
  tx: Tx,
  actor: UserActor,
  criteriaSetId: unknown,
  from: { product: ProductInfo; copiedFrom: string | null; evidenceFileIds?: string[] },
) {
  const now = deps.clock.now();
  const entity = await verifiedEntity(tx, actor, now);
  if (!isUuid(criteriaSetId)) throw setNotApplicable();
  const [{ version }, found] = await Promise.all([applicableVersion(tx, now), tx.criteriaVersions.findSet(criteriaSetId)]);
  if (!found || found.versionId !== version.id) throw setNotApplicable();
  const dossier: Dossier = {
    id: deps.ids.next(),
    entityId: entity.id,
    criteriaSetId,
    criteriaVersionId: version.id,
    state: "draft",
    wardId: null,
    roundId: null,
    ...from.product,
    receivedAt: null,
    receivedBy: null,
    handlerUserId: null,
    firstForwardedAt: null,
    code: await nextDossierCode(tx, now),
    provinceReceivedAt: null,
    provinceReceivedBy: null,
    firstProvinceReceivedAt: null,
    gradingStartedAt: null,
    councilId: null,
    readerAssignment: null,
    supplementDeadline: null,
    copiedFrom: from.copiedFrom,
    deletedAt: null,
    resultPublishedAt: null,
    generalComment: null,
    generalCommentUpdatedAt: null,
    generalCommentUpdatedBy: null,
    awaitingSupplementaryDecision: false,
    ministryReturnFileId: null,
    version: 1,
    createdAt: now,
    createdBy: actor.userId,
    updatedAt: now,
  };
  await recordCreation(deps, tx, actor, dossier, {
    criteriaSetId,
    criteriaVersionId: version.id,
    ...(from.copiedFrom ? { copiedFrom: from.copiedFrom, evidenceFileIds: from.evidenceFileIds ?? [] } : {}),
  });
  for (const fileId of from.evidenceFileIds ?? []) {
    await tx.dossiers.addEvidence({ dossierId: dossier.id, fileId, addedBy: actor.userId, addedAt: now });
  }
  return dossier;
}

/**
 * L02 CT-03 (stories 15 to 17): a Chủ thể Đã xác thực starts a Nháp on one Bộ tiêu chí of the applicable
 * Phiên bản tiêu chí. The Bộ tiêu chí, and with it the văn bản căn cứ, never change afterwards.
 */
export function createDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { criteriaSetId: string }): Promise<{ dossierId: string }> => {
    authorize(actor, "dossier.create");
    return deps.uow.run(async (tx) => ({ dossierId: (await newDraft(deps, tx, actor, input.criteriaSetId, { product: EMPTY_PRODUCT, copiedFrom: null })).id }));
  };
}

/**
 * Story 27, Sao chép sang hồ sơ mới: from any hồ sơ of the Chủ thể, whatever its state, a new Nháp on a
 * Bộ tiêu chí chosen again. It takes the thông tin sản phẩm and the files of the kho minh chứng (the same
 * files, not tied to any Tiêu chí), never the tự chấm or giải trình, and remembers where it came from.
 */
export function copyDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; criteriaSetId: string }): Promise<{ dossierId: string }> => {
    authorize(actor, "dossier.create");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const source = await tx.dossiers.findById(scope, input.dossierId);
      if (!source) throw dossierNotFound();
      const product: ProductInfo = {
        productName: source.productName,
        description: source.description,
        ingredients: source.ingredients,
        process: source.process,
        packaging: source.packaging,
        qualityDeclaration: source.qualityDeclaration,
      };
      const evidenceFileIds = (await tx.dossiers.evidence(source.id)).map((file) => file.fileId);
      const copy = await newDraft(deps, tx, actor, input.criteriaSetId, { product, copiedFrom: source.id, evidenceFileIds });
      return { dossierId: copy.id };
    });
  };
}
