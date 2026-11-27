import { auditEntry } from "../audit/audit";
import { issueFileDownload } from "../files/download";
import { starOutcome } from "./decision-model";
import { assembleSet } from "../criteria/detail";
import { criteriaOf } from "../criteria/model";
import { PDF_TYPE } from "../documents/pdf";
import type { ResultLetterData } from "../documents/renderer";
import { storeGeneratedDocument } from "../documents/store";
import { renderDocument } from "../documents/templates";
import { lockDossier } from "../dossiers/edit";
import { DOSSIER_STATE_LABEL, dossierNotFound, versionConflict, type Dossier, type DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import type { DossierAction } from "../dossiers/transitions";
import { authorize, can } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import { vnDateOf } from "../rounds/model";
import type { AggregateResult } from "../scoring/meeting-model";
import { setRowsOf } from "../scoring/sheets";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError, forbidden } from "../shared/errors";
import { formatDayVn, formatDecimalVn } from "../shared/format";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { underperformingRatioIn } from "../system/settings";
import type { LetterCriterion, ResultLetter } from "./result-letter-model";
import { underperformingCriteria, type UnderperformingCriterion, type UnderperformingReason } from "./underperforming";

/*
 * L16 HD-10, CT-13 Thư kết quả không đạt (#85, spec #79 stories 36 to 45, 66). The Cán bộ Sở soạn the letter of a hồ sơ
 * dưới 3 sao Đã chốt điểm from what the kết quả chốt hiện hành prefills (điểm, Phần, Hạng sao, Nhận xét chung, Tiêu chí
 * dưới mức), adjusts the Tiêu chí (only of the hồ sơ's own Bộ tiêu chí), adds a lời khuyên, previews the DOCX (not
 * stored) and phát hành: the PDF is rendered and converted before the transaction, then in one transaction stored, the
 * letter recorded, the hồ sơ moved to Không đạt with Công bố kết quả (first letter only), and the outbox written. A thư
 * đính chính is the next phiên bản with its lý do. No Xác thực lại (spec #79).
 */

export const MAX_ADVICE = 4000;
export const MAX_CORRECTION_REASON = 1000;

export interface ResultLetterInput {
  dossierId: string;
  /** The hồ sơ version the Sở prepared the letter against. */
  expectedVersion: number;
  /** The Tiêu chí dưới mức to list, of the hồ sơ's Bộ tiêu chí; printed in phiếu order. */
  criterionIds: string[];
  /** Lời khuyên cải thiện, free text. */
  advice: string;
  /** Lý do of a thư đính chính; required from the second letter on. */
  reason?: string | null;
}

export const LETTER_REASON_LABEL: Record<UnderperformingReason, string> = {
  min_star: "Sao tối thiểu chưa đạt",
  low_ratio: "Điểm trung bình dưới tỷ lệ",
};

const reasonText = (reasons: readonly UnderperformingReason[]) => reasons.map((r) => LETTER_REASON_LABEL[r]).join("; ") || "Sở bổ sung";

/** The row of the transition table a letter takes from the hồ sơ's state. */
function letterAction(state: DossierState): DossierAction {
  if (state === "score_finalized") return "dossier.result_letter.issue";
  if (state === "not_passed") return "dossier.result_letter.correct";
  throw new DomainError("invalid_state", `Không thể phát hành thư khi hồ sơ đang ở trạng thái ${DOSSIER_STATE_LABEL[state]}`);
}

const starTooHigh = () => new DomainError("result_letter_not_below_three", "Thư kết quả không đạt chỉ dành cho hồ sơ dưới 3 sao");

/** The kết quả chốt hiện hành of a hồ sơ dưới 3 sao the Sở may write to; refuses anything else. */
async function letterResult(tx: Tx, actor: UserActor, d: Dossier): Promise<AggregateResult> {
  const action = letterAction(d.state);
  if (!can(actor, action, d)) throw forbidden();
  const result = await tx.aggregateResults.current(d.id);
  if (!result) throw new DomainError("invalid_state", "Hồ sơ chưa có kết quả chốt hiện hành");
  if (starOutcome(result.star) !== "not_passed") throw starTooHigh();
  return result;
}

/** What the kết quả chốt and the hồ sơ's Bộ tiêu chí give the letter: every Tiêu chí, and the computed dưới mức. */
async function criteriaFacts(tx: Tx, d: Dossier, result: AggregateResult) {
  const set = assembleSet(await setRowsOf(tx, d));
  const all = set.parts.flatMap(criteriaOf);
  const suggested = underperformingCriteria(result, set, await underperformingRatioIn(tx));
  return { all, suggested };
}

function textOf(value: unknown, max: number, tooLong: string): string {
  if (value !== undefined && value !== null && typeof value !== "string") throw new DomainError("result_letter_invalid", "Nội dung thư không hợp lệ");
  const text = (value ?? "").trim();
  if (text.length > max) throw new DomainError("field_too_long", tooLong);
  return text;
}

interface Prepared {
  dossier: Dossier;
  action: DossierAction;
  n: number;
  criteria: LetterCriterion[];
  advice: string;
  reason: string | null;
  data: ResultLetterData;
}

/**
 * Checks a letter against the hồ sơ as it is now and builds what it prints. Called to preview, before rendering and again
 * inside the phát hành transaction on the locked hồ sơ, so nothing changed in between goes out.
 */
async function prepare(deps: CoreDeps, tx: Tx, actor: UserActor, d: Dossier, input: ResultLetterInput): Promise<Prepared> {
  if (input.expectedVersion !== d.version) throw versionConflict();
  const result = await letterResult(tx, actor, d);
  const advice = textOf(input.advice, MAX_ADVICE, `Lời khuyên tối đa ${MAX_ADVICE.toLocaleString("vi-VN")} ký tự`);
  const previous = await tx.resultLetters.list(d.id);
  const n = previous.length + 1;
  const correctionText = textOf(input.reason, MAX_CORRECTION_REASON, `Lý do đính chính tối đa ${MAX_CORRECTION_REASON.toLocaleString("vi-VN")} ký tự`);
  if (n > 1 && !correctionText) throw new DomainError("reason_required", "Cần nêu lý do phát hành thư đính chính");
  const reason = n > 1 ? correctionText : null;

  if (!Array.isArray(input.criterionIds) || input.criterionIds.some((id) => typeof id !== "string")) {
    throw new DomainError("result_letter_invalid", "Danh sách tiêu chí không hợp lệ");
  }
  const { all, suggested } = await criteriaFacts(tx, d, result);
  const chosen = new Set(input.criterionIds);
  const known = new Set(all.map((c) => c.id));
  if ([...chosen].some((id) => !known.has(id))) {
    throw new DomainError("criterion_not_in_set", "Chỉ chọn được tiêu chí thuộc Bộ tiêu chí của hồ sơ");
  }
  const computed = new Map(suggested.map((c) => [c.criterionId, c]));
  const criteria: LetterCriterion[] = all
    .filter((c) => chosen.has(c.id))
    .map((c) => ({
      criterionId: c.id,
      code: c.code,
      name: c.name,
      average: result.averages[c.id] ?? 0,
      maxPoints: c.maxPoints,
      reasons: computed.get(c.id)?.reasons ?? [],
    }));

  const snap = (await tx.dossiers.latestSubmission(d.id))?.snapshot;
  const round = d.roundId ? await tx.rounds.findById(d.roundId) : null;
  const data: ResultLetterData = {
    letterNumber: String(n),
    correctionNote: reason ? `Thư này đính chính Thư kết quả số ${n - 1}. Lý do: ${reason}` : "",
    dossierCode: d.code,
    entityName: snap?.entity.name ?? "",
    address: snap?.entity.address ?? "",
    representativeName: snap?.entity.representativeName ?? "",
    productName: d.productName,
    criteriaSetCode: snap?.criteriaSet.code ?? "",
    criteriaSetName: snap?.criteriaSet.name ?? "",
    roundName: round?.name ?? "",
    total: formatDecimalVn(result.total),
    parts: result.parts.map((p) => ({ code: p.code, total: formatDecimalVn(p.total) })),
    star: `${result.star} sao (không đạt)`,
    generalComment: d.generalComment ?? "",
    criteria: criteria.map((c, i) => ({
      index: String(i + 1),
      code: c.code,
      name: c.name,
      average: formatDecimalVn(c.average),
      maxPoints: formatDecimalVn(c.maxPoints),
      reason: reasonText(c.reasons),
    })),
    advice,
    issuedOn: formatDayVn(vnDateOf(deps.clock.now())),
  };
  return { dossier: d, action: letterAction(d.state), n, criteria, advice, reason, data };
}

async function loadDossier(tx: Tx, actor: UserActor, dossierId: unknown): Promise<Dossier> {
  assertIdShape(dossierId, dossierNotFound);
  const d = await tx.dossiers.findById(dataScopeOf(actor), dossierId);
  if (!d) throw dossierNotFound();
  return d;
}

const fileNameOf = (d: Dossier, n: number, ext: "docx" | "pdf") => `Thu ket qua ${d.code}${n > 1 ? ` (dinh chinh ${n - 1})` : ""}.${ext}`;

export interface LetterView {
  id: string;
  n: number;
  criteria: LetterCriterion[];
  advice: string;
  reason: string | null;
  issuedAt: Date;
  issuedBy: { userId: string; fullName: string };
  file: { id: string; fileName: string };
}

export interface ResultLetterDraftView {
  dossierId: string;
  dossierVersion: number;
  dossierState: DossierState;
  code: string;
  productName: string;
  total: number;
  parts: { code: string; total: number }[];
  star: number;
  generalComment: string | null;
  /** Tiêu chí dưới mức computed from the kết quả chốt (story 37), the list a new letter starts from. */
  suggested: UnderperformingCriterion[];
  /** Every Tiêu chí of the hồ sơ's Bộ tiêu chí, those the Sở may add (story 38). */
  criteria: { criterionId: string; code: string; name: string; average: number; maxPoints: number }[];
  /** The phiên bản issued, oldest first. */
  letters: LetterView[];
}

async function letterViews(tx: Tx, letters: readonly ResultLetter[]): Promise<LetterView[]> {
  const out: LetterView[] = [];
  for (const l of letters) {
    const user = await tx.users.findById(l.issuedBy);
    const file = await tx.files.findById(l.fileId);
    out.push({
      id: l.id,
      n: l.n,
      criteria: l.criteria,
      advice: l.advice,
      reason: l.reason,
      issuedAt: l.issuedAt,
      issuedBy: { userId: l.issuedBy, fullName: user?.fullName ?? "" },
      file: { id: l.fileId, fileName: file?.fileName ?? "" },
    });
  }
  return out;
}

/** Story 36: what the Sở soạn a letter from; refused for a hồ sơ the letter is not for (3 sao and up, before chốt). */
export function resultLetterDraft(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<ResultLetterDraftView> => {
    authorize(actor, "results.result_letter.issue");
    return deps.uow.run(async (tx) => {
      const d = await loadDossier(tx, actor, input.dossierId);
      const result = await letterResult(tx, actor, d);
      const { all, suggested } = await criteriaFacts(tx, d, result);
      return {
        dossierId: d.id,
        dossierVersion: d.version,
        dossierState: d.state,
        code: d.code,
        productName: d.productName,
        total: result.total,
        parts: result.parts.map((p) => ({ code: p.code, total: p.total })),
        star: result.star,
        generalComment: d.generalComment,
        suggested,
        criteria: all.map((c) => ({ criterionId: c.id, code: c.code, name: c.name, average: result.averages[c.id] ?? 0, maxPoints: c.maxPoints })),
        letters: await letterViews(tx, await tx.resultLetters.list(d.id)),
      };
    });
  };
}

/** Story 36: the letter as it would be issued, as DOCX; nothing is stored. */
export function previewResultLetter(deps: CoreDeps) {
  return async (actor: Actor, input: ResultLetterInput): Promise<{ fileName: string; bytes: Uint8Array }> => {
    authorize(actor, "results.result_letter.issue");
    return deps.uow.run(async (tx) => {
      const p = await prepare(deps, tx, actor, await loadDossier(tx, actor, input.dossierId), input);
      const { bytes } = await renderDocument(deps, tx, "result_letter", p.data);
      return { fileName: fileNameOf(p.dossier, p.n, "docx"), bytes };
    });
  };
}

export interface IssuedLetter {
  letterId: string;
  n: number;
  fileId: string;
  /** The hồ sơ version after the letter. */
  version: number;
}

/**
 * Stories 40 to 43: phát hành the letter, or a thư đính chính after it. The DOCX is filled and turned into PDF before
 * the transaction (Gotenberg may be slow); the transaction then checks everything again on the locked hồ sơ, so a hồ sơ
 * changed meanwhile is refused by its version.
 */
export function issueResultLetter(deps: CoreDeps) {
  return async (actor: Actor, input: ResultLetterInput): Promise<IssuedLetter> => {
    authorize(actor, "results.result_letter.issue");
    const rendered = await deps.uow.run(async (tx) => {
      const p = await prepare(deps, tx, actor, await loadDossier(tx, actor, input.dossierId), input);
      return { n: p.n, ...(await renderDocument(deps, tx, "result_letter", p.data)) };
    });
    const pdf = await deps.pdf.toPdf(rendered.bytes);

    return deps.uow.run(async (tx) => {
      const p = await prepare(deps, tx, actor, await lockDossier(tx, actor, input.dossierId), input);
      // Another letter issued between the render and now: what was rendered carries the wrong number.
      if (p.n !== rendered.n) throw versionConflict();
      const now = deps.clock.now();
      const fileId = await storeGeneratedDocument(deps, tx, actor, {
        fileName: fileNameOf(p.dossier, p.n, "pdf"),
        bytes: pdf,
        contentType: PDF_TYPE,
        metadata: { dossierId: p.dossier.id, document: "result_letter", n: p.n, templateVersionId: rendered.templateVersionId },
      });
      const letter: ResultLetter = {
        id: deps.ids.next(),
        dossierId: p.dossier.id,
        n: p.n,
        criteria: p.criteria,
        advice: p.advice,
        reason: p.reason,
        fileId,
        templateVersionId: rendered.templateVersionId,
        issuedBy: actor.userId,
        issuedAt: now,
      };
      if (!(await tx.resultLetters.insert(letter))) throw versionConflict();
      const first = p.n === 1;
      const after = await transition(deps, tx, actor, p.dossier, {
        action: p.action,
        expectedVersion: p.dossier.version,
        ...(first ? { patch: { resultPublishedAt: now }, outcome: "not_passed" as const } : {}),
        reason: p.reason,
        metadata: { letterId: letter.id, n: letter.n },
      });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.result_letter.issued",
          targetType: "result_letter",
          targetId: letter.id,
          after: { dossierId: letter.dossierId, n: letter.n, fileId, templateVersionId: letter.templateVersionId },
          metadata: { criteria: letter.criteria.map((c) => ({ code: c.code, reasons: c.reasons })), advice: letter.advice, reason: letter.reason },
        }),
      );
      await emit(deps, tx, {
        type: "result_letter.issued",
        payload: { dossierId: letter.dossierId, entityId: p.dossier.entityId, letterId: letter.id, n: letter.n },
      });
      return { letterId: letter.id, n: letter.n, fileId, version: after.version };
    });
  };
}

/**
 * Story 66: a short-lived link to the PDF of a letter, audited like any download. The Chủ thể gets only the newest
 * phiên bản of its own hồ sơ (story 44); the Cán bộ Sở any phiên bản, by `letterId`, the newest by default.
 */
export function downloadResultLetter(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; letterId?: string }): Promise<{ url: string; expiresAt: Date }> => {
    authorize(actor, "results.result_letter.download");
    const notFound = () => new DomainError("not_found", "Không tìm thấy Thư kết quả");
    if (input.letterId !== undefined) assertIdShape(input.letterId, notFound);
    return deps.uow.run(async (tx) => {
      const d = await loadDossier(tx, actor, input.dossierId);
      const letters = await tx.resultLetters.list(d.id);
      const newest = letters.at(-1);
      const letter = input.letterId === undefined ? newest : letters.find((l) => l.id === input.letterId);
      // An earlier phiên bản only for who issues them; the Chủ thể sees the newest alone (story 44).
      if (!letter || (letter !== newest && !can(actor, "results.result_letter.issue"))) throw notFound();
      return issueFileDownload(deps, tx, actor, letter.fileId, notFound, { dossierId: d.id, letterId: letter.id, n: letter.n });
    });
  };
}
