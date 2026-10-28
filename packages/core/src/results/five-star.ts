import { issueFileDownload } from "../files/download";
import { lockDossier } from "../dossiers/edit";
import { dossierNotFound, type DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { ownUpload } from "../files/attach";
import type { FileStatus } from "../files/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { endOfVnDay, vnDateOf } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { FIVE_STAR_CLOSURE_OUTCOMES, type FiveStarClosure, type FiveStarClosureOutcome } from "./five-star-model";

/*
 * L17 SO-04 Đề xuất 5 sao (#87, spec #79 stories 46, 53 to 55, 58 to 60; ADR 0009). The Cán bộ Sở alone, no Xác thực lại.
 * Each change is one row of the transition table (audit, outbox and timeline in the same transaction) plus what it
 * records: the công văn of đánh dấu đã gửi, the Bộ's văn bản of chuyển về, the outcome of đóng hồ sơ.
 */

const MAX_NUMBER = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function numberOf(value: unknown, required: () => DomainError, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw required();
  if (text.length > MAX_NUMBER) throw new DomainError("field_too_long", `${label} quá dài`);
  return text;
}

/** A calendar date (YYYY-MM-DD) not after `today` in Vietnam; `field` names the error codes `<field>_invalid`, `<field>_in_future`. */
function pastDateOf(value: unknown, today: string, field: string, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const invalid = () => new DomainError(`${field}_invalid`, `${label} không hợp lệ`);
  if (!ISO_DATE.test(text)) throw invalid();
  try {
    endOfVnDay(text);
  } catch {
    throw invalid();
  }
  if (text > today) throw new DomainError(`${field}_in_future`, `${label} không được sau ngày hôm nay`);
  return text;
}

const ministryFileRequired = () => new DomainError("file_required", "Tải lên văn bản của Bộ (PDF)");

export interface FiveStarRow {
  dossierId: string;
  code: string;
  productName: string;
  entityName: string;
  wardName: string;
  state: DossierState;
  version: number;
  /** The kết quả chốt hiện hành, as stored. */
  total: number;
  star: number;
  publishedAt: Date | null;
  /** Đánh dấu đã gửi, once recorded. */
  dispatch: { number: string; sentOn: string } | null;
  /** Chuyển về công nhận cấp tỉnh: waiting for a Quyết định công nhận bổ sung (ADR 0009). */
  awaitingSupplementaryDecision: boolean;
  returnFile: { id: string; fileName: string; status: FileStatus } | null;
}

export interface FiveStarListInput {
  /** Story 55: only the hồ sơ chờ Quyết định công nhận bổ sung (true) or only the others Đã gửi (false). */
  awaiting?: boolean;
}

async function fileRef(tx: Tx, id: string | null) {
  const f = id ? await tx.files.findById(id) : null;
  return f && { id: f.id, fileName: f.fileName, status: f.status };
}

/** Story 46: the "Đề xuất 5 sao" list, Đã chốt điểm first then by mã hồ sơ. */
export function fiveStarList(deps: CoreDeps) {
  return async (actor: Actor, input: FiveStarListInput = {}): Promise<FiveStarRow[]> => {
    authorize(actor, "results.five_star.manage");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const candidates = await tx.fiveStar.candidates(typeof input.awaiting === "boolean" ? { awaiting: input.awaiting } : {});
      const wards = new Map((await tx.wards.list()).map((w) => [w.id, w.name]));
      const rows: FiveStarRow[] = [];
      for (const c of candidates) {
        const d = await tx.dossiers.findById(scope, c.dossierId);
        if (!d) continue;
        const dispatch = await tx.fiveStar.dispatchOf(d.id);
        rows.push({
          dossierId: d.id,
          code: d.code,
          productName: d.productName,
          entityName: (await tx.entities.findById(scope, d.entityId))?.name ?? "",
          wardName: (d.wardId && wards.get(d.wardId)) || "",
          state: d.state,
          version: d.version,
          total: c.total,
          star: c.star,
          publishedAt: d.resultPublishedAt,
          dispatch: dispatch && { number: dispatch.dispatchNumber, sentOn: dispatch.sentOn },
          awaitingSupplementaryDecision: d.awaitingSupplementaryDecision,
          returnFile: await fileRef(tx, d.ministryReturnFileId),
        });
      }
      const order = (s: DossierState) => (s === "score_finalized" ? 0 : 1);
      return rows.sort((a, b) => order(a.state) - order(b.state) || a.code.localeCompare(b.code));
    });
  };
}

export interface MarkFiveStarSentInput {
  dossierId: string;
  expectedVersion: number;
  /** Số công văn of the tỉnh's đề nghị. */
  dispatchNumber: string;
  /** Ngày gửi, YYYY-MM-DD; not after today in Vietnam. */
  sentOn: string;
}

/** Story 53: đánh dấu đã gửi a hồ sơ 5 sao Công bố → Đã gửi đề nghị 5 sao. */
export function markFiveStarSent(deps: CoreDeps) {
  return async (actor: Actor, input: MarkFiveStarSentInput): Promise<{ version: number }> => {
    authorize(actor, "results.five_star.manage");
    const dispatchNumber = numberOf(input.dispatchNumber, () => new DomainError("dispatch_number_required", "Cần nhập số công văn"), "Số công văn");
    const now = deps.clock.now();
    const sentOn = pastDateOf(input.sentOn, vnDateOf(now), "sent_on", "Ngày gửi");
    assertIdShape(input.dossierId, dossierNotFound);
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      // The guard sees the hồ sơ only; Hạng sao 5 is the kết quả chốt hiện hành's (never recomputed).
      if (before.state === "score_finalized" && (await tx.aggregateResults.current(before.id))?.star !== 5) {
        throw new DomainError("not_five_star", "Chỉ hồ sơ đạt hạng 5 sao mới được đề nghị Trung ương đánh giá 5 sao");
      }
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.five_star.mark_sent",
        expectedVersion: input.expectedVersion,
        metadata: { dispatchNumber, sentOn },
      });
      await tx.fiveStar.insertDispatch({ dossierId: before.id, dispatchNumber, sentOn, recordedBy: actor.userId, recordedAt: now });
      return { version: after.version };
    });
  };
}

export interface ReturnFiveStarInput {
  dossierId: string;
  expectedVersion: number;
  /** The Bộ's văn bản, uploaded with purpose `ministry_document`. */
  fileId: string;
}

/** Story 54: chuyển về công nhận cấp tỉnh: the hồ sơ waits, still Đã gửi đề nghị 5 sao, for a Quyết định công nhận bổ sung. */
export function returnFiveStarToProvince(deps: CoreDeps) {
  return async (actor: Actor, input: ReturnFiveStarInput): Promise<{ version: number }> => {
    authorize(actor, "results.five_star.manage");
    assertIdShape(input.dossierId, dossierNotFound);
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const file = await ownUpload(tx, actor, input.fileId, "ministry_document", ministryFileRequired);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.five_star.return_to_province",
        expectedVersion: input.expectedVersion,
        patch: { awaitingSupplementaryDecision: true, ministryReturnFileId: file.id },
        metadata: { fileId: file.id },
      });
      return { version: after.version };
    });
  };
}

export interface CloseFiveStarInput {
  dossierId: string;
  expectedVersion: number;
  outcome: FiveStarClosureOutcome;
  /** Số and ngày (YYYY-MM-DD) of the Bộ's quyết định: required for `ministry_recognized_5_star`, ignored otherwise. */
  decisionNumber?: string;
  decidedOn?: string;
  /** The Bộ's văn bản, uploaded with purpose `ministry_document`. */
  fileId: string;
}

/** Stories 58, 59: đóng hồ sơ on the Bộ's answer → Đã đóng, xử lý ngoài hệ thống. */
export function closeFiveStar(deps: CoreDeps) {
  return async (actor: Actor, input: CloseFiveStarInput): Promise<{ version: number }> => {
    authorize(actor, "results.five_star.manage");
    if (!(FIVE_STAR_CLOSURE_OUTCOMES as readonly string[]).includes(input.outcome)) {
      throw new DomainError("closure_outcome_invalid", "Chọn kết quả của Bộ");
    }
    const now = deps.clock.now();
    const recognized = input.outcome === "ministry_recognized_5_star";
    const decisionNumber = recognized
      ? numberOf(input.decisionNumber, () => new DomainError("decision_number_required", "Cần nhập số quyết định của Bộ"), "Số quyết định")
      : null;
    const decidedOn = recognized ? pastDateOf(input.decidedOn, vnDateOf(now), "decided_on", "Ngày quyết định") : null;
    assertIdShape(input.dossierId, dossierNotFound);
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const file = await ownUpload(tx, actor, input.fileId, "ministry_document", ministryFileRequired);
      const closure: FiveStarClosure = {
        dossierId: before.id,
        outcome: input.outcome,
        decisionNumber,
        decidedOn,
        fileId: file.id,
        closedBy: actor.userId,
        closedAt: now,
      };
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.five_star.close",
        expectedVersion: input.expectedVersion,
        metadata: { outcome: closure.outcome, decisionNumber, decidedOn, fileId: file.id },
      });
      await tx.fiveStar.insertClosure(closure);
      return { version: after.version };
    });
  };
}

/** The Bộ's văn bản of a hồ sơ (chuyển về or đóng), for any Cán bộ Sở: a short-lived link, audited like any download. */
export function downloadMinistryDocument(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; fileId: string }): Promise<{ url: string; expiresAt: Date }> => {
    authorize(actor, "results.five_star.manage");
    const notFound = () => new DomainError("not_found", "Không tìm thấy văn bản của Bộ");
    assertIdShape(input.dossierId, dossierNotFound);
    assertIdShape(input.fileId, notFound);
    return deps.uow.run(async (tx) => {
      const d = await tx.dossiers.findById(dataScopeOf(actor), input.dossierId);
      if (!d) throw dossierNotFound();
      const closure = await tx.fiveStar.closureOf(d.id);
      if (input.fileId !== d.ministryReturnFileId && input.fileId !== closure?.fileId) throw notFound();
      return issueFileDownload(deps, tx, actor, input.fileId, notFound, { dossierId: d.id });
    });
  };
}
