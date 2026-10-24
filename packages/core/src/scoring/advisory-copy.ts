import { isMemberInForce } from "../councils/assignment-model";
import { lockDossier } from "../dossiers/edit";
import { DOSSIER_STATE_LABEL, dossierNotFound, versionConflict, type Dossier, type DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { ruleFor } from "../dossiers/transitions";
import { authorize, can } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError, forbidden } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { AdvisoryReportVersion } from "./advisory-report-model";
import type { ScoreSheet, ScoreSheetLine } from "./score-sheet-model";
import { setRowsOf, sheetOrder } from "./sheets";

/*
 * L12 TM-08, TM-09 (#58, spec #49 "Sao chép (L12)", stories 65 to 77): a Thành viên Tổ tư vấn Phân công on a hồ sơ
 * sao chép the Điểm đề xuất and căn cứ of an issued Báo cáo Tổ tư vấn phiên bản into the Phiếu chấm of the thành
 * viên chấm, one or many hồ sơ at once. Each dòng in scope that the thành viên has not touched takes the phiên bản's
 * Mức điểm, with `source = advisory` and the Mức điểm gốc; a dòng they edited is kept and reported; a Phiếu chấm
 * no longer draft is kept whole. The first sao chép moves the hồ sơ to Thành viên xem xét, which opens grading.
 * `previewAdvisoryCopy` computes the same plan as `copyAdvisory` without writing.
 */

export interface AdvisoryCopyScope {
  /** `all`, or the mã of the Tiêu chí to copy (story 66). */
  criteria: "all" | string[];
  /** `all` the thành viên chấm Phân công in force, or these Người dùng among them (story 67). */
  recipients: "all" | string[];
}

export interface PreviewAdvisoryCopyInput extends AdvisoryCopyScope {
  /** Each hồ sơ with the phiên bản to copy; the newest issued one when left out (story 68). */
  dossiers: { dossierId: string; advisoryVersionId?: string }[];
}

export interface CopyAdvisoryInput extends AdvisoryCopyScope {
  dossiers: { dossierId: string; expectedVersion: number; advisoryVersionId?: string }[];
}

/**
 * What the sao chép does to one thành viên chấm's Phiếu chấm: `new` fills one never copied into, `update` one
 * copied into before; `confirmed`, `absent` and `none` (no Phiếu chấm) are skipped whole.
 */
export type CopySheetOutcome = "new" | "update" | "confirmed" | "absent" | "none";

export interface AdvisoryCopyRecipient {
  userId: string;
  fullName: string;
  sheet: CopySheetOutcome;
  /** Mã of the Tiêu chí written, in sheet order. */
  written: string[];
  /** Mã of the Tiêu chí in scope kept because the thành viên edited them (story 72). */
  edited: string[];
}

export interface AdvisoryCopyPlan {
  dossierId: string;
  code: string;
  productName: string;
  advisoryVersion: { id: string; number: number };
  /** Mã of the Tiêu chí in scope. */
  criteria: string[];
  recipients: AdvisoryCopyRecipient[];
  /** Dòng written over all recipients (story 70). */
  written: number;
  /** What was kept, by recipient: a Tiêu chí mã, or null for the whole Phiếu chấm (story 70). */
  skipped: { userId: string; fullName: string; criterion: string | null; reason: "edited" | CopySheetOutcome }[];
}

/** A refusal for one hồ sơ of the lô, naming it (spec #49: one conflict rolls the lô back and says which). */
export class AdvisoryCopyRefused extends DomainError {
  static override readonly brand = "AdvisoryCopyRefused";

  constructor(
    readonly dossierId: string,
    readonly dossierCode: string | null,
    readonly refusal: DomainError,
  ) {
    super(refusal.code, dossierCode ? `Hồ sơ ${dossierCode}: ${refusal.message}` : refusal.message);
  }
}

interface SheetWrite {
  sheet: ScoreSheet;
  lines: Omit<ScoreSheetLine, "updatedAt">[];
}

function validScope(input: AdvisoryCopyScope & { dossiers: unknown[] }) {
  if (!Array.isArray(input.dossiers) || input.dossiers.length === 0) throw new DomainError("dossiers_required", "Chọn ít nhất một hồ sơ để sao chép");
  if (input.criteria !== "all" && (!Array.isArray(input.criteria) || input.criteria.length === 0)) {
    throw new DomainError("criteria_required", "Chọn ít nhất một Tiêu chí để sao chép");
  }
  if (input.recipients !== "all" && (!Array.isArray(input.recipients) || input.recipients.length === 0)) {
    throw new DomainError("recipients_required", "Chọn ít nhất một thành viên nhận");
  }
}

/** The row checks transition() makes, for the xem trước, which moves nothing. */
function assertCopyRow(actor: UserActor, dossier: Dossier) {
  if (!ruleFor("dossier.advisory_copy", dossier.state)) {
    throw new DomainError("invalid_state", `Không thể thực hiện thao tác này khi hồ sơ đang ở trạng thái ${DOSSIER_STATE_LABEL[dossier.state]}`);
  }
  if (!can(actor, "dossier.advisory_copy", dossier)) throw forbidden();
}

/** Story 77: never in a đợt chấm trực tiếp. */
async function assertAdvisoryMode(tx: Tx, dossier: Dossier) {
  const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
  if (round?.gradingMode !== "advisory_based") {
    throw new DomainError("not_advisory_mode", "Đợt đánh giá chấm trực tiếp nên không sao chép từ Tổ tư vấn");
  }
}

/** The plan for one hồ sơ already loaded within scope, and the dòng it would write. */
async function planOf(tx: Tx, dossier: Dossier, scope: AdvisoryCopyScope, advisoryVersionId: string | undefined): Promise<{ plan: AdvisoryCopyPlan; writes: SheetWrite[] }> {
  const versions = await tx.advisoryReports.versions(dossier.id);
  if (versions.length === 0) throw new DomainError("no_issued_version", "Hồ sơ chưa có Báo cáo Tổ tư vấn đã phát hành");
  const version: AdvisoryReportVersion | undefined = advisoryVersionId === undefined ? versions.at(-1) : versions.find((v) => v.id === advisoryVersionId);
  if (!version) throw new DomainError("advisory_version_not_found", "Không tìm thấy phiên bản Báo cáo Tổ tư vấn này của hồ sơ");

  const order = sheetOrder(await setRowsOf(tx, dossier));
  if (scope.criteria !== "all") {
    const unknown = scope.criteria.filter((code) => !order.some((c) => c.code === code));
    if (unknown.length > 0) throw new DomainError("criterion_not_in_set", `Tiêu chí không thuộc Bộ tiêu chí của hồ sơ: ${unknown.join(", ")}`);
  }
  const wanted = scope.criteria;
  const inScope = order.filter((c) => wanted === "all" || wanted.includes(c.code));
  const proposed = new Map(version.snapshot.lines.map((l) => [l.criterionId, l]));

  const members = (await tx.assignments.current(dossier.id)).filter(isMemberInForce);
  const chosen = scope.recipients === "all" ? members : members.filter((a) => (scope.recipients as string[]).includes(a.userId));
  if (chosen.length === 0) throw new DomainError("recipient_not_assigned", "Không có thành viên chấm nào được chọn trong Phân công của hồ sơ");
  const sheets = await tx.scoreSheets.current(dossier.id);

  const recipients: AdvisoryCopyRecipient[] = [];
  const writes: SheetWrite[] = [];
  for (const a of chosen) {
    const fullName = (await tx.users.findById(a.userId))?.fullName ?? "";
    const sheet = sheets.find((s) => s.assignmentId === a.id);
    if (!sheet || sheet.state !== "draft") {
      recipients.push({ userId: a.userId, fullName, sheet: sheet ? (sheet.state === "absent" ? "absent" : "confirmed") : "none", written: [], edited: [] });
      continue;
    }
    const stored = new Map((await tx.scoreSheets.lines(sheet.id)).map((l) => [l.criterionId, l]));
    const written: string[] = [];
    const edited: string[] = [];
    const lines: SheetWrite["lines"] = [];
    for (const c of inScope) {
      const was = stored.get(c.id);
      const from = proposed.get(c.id);
      if (!from) continue;
      if (was?.edited) {
        edited.push(c.code);
        continue;
      }
      written.push(c.code);
      lines.push({
        scoreSheetId: sheet.id,
        criterionId: c.id,
        scoreLevelId: from.levelId,
        comment: from.basis,
        source: "advisory",
        advisoryVersionId: version.id,
        advisoryLevelOriginal: from.levelId,
        adjustReason: null,
        edited: false,
        fileIds: was?.fileIds ?? [],
      });
    }
    const copiedBefore = [...stored.values()].some((l) => l.source === "advisory");
    recipients.push({ userId: a.userId, fullName, sheet: copiedBefore ? "update" : "new", written, edited });
    if (lines.length > 0) writes.push({ sheet, lines });
  }
  recipients.sort((x, y) => x.fullName.localeCompare(y.fullName, "vi"));
  const skipped = recipients.flatMap((r): AdvisoryCopyPlan["skipped"] =>
    r.sheet === "new" || r.sheet === "update"
      ? r.edited.map((code) => ({ userId: r.userId, fullName: r.fullName, criterion: code, reason: "edited" }))
      : [{ userId: r.userId, fullName: r.fullName, criterion: null, reason: r.sheet }],
  );
  return {
    plan: {
      dossierId: dossier.id,
      code: dossier.code,
      productName: dossier.productName,
      advisoryVersion: { id: version.id, number: version.number },
      criteria: inScope.map((c) => c.code),
      recipients,
      written: recipients.reduce((n, r) => n + r.written.length, 0),
      skipped,
    },
    writes,
  };
}

/** Runs `fn` for one hồ sơ of the lô, naming the hồ sơ in any refusal. */
async function forDossier<T>(dossierId: string, fn: (named: (d: Dossier) => void) => Promise<T>): Promise<T> {
  let code: string | null = null;
  try {
    return await fn((d) => (code = d.code));
  } catch (err) {
    if (err instanceof DomainError && !(err instanceof AdvisoryCopyRefused)) throw new AdvisoryCopyRefused(dossierId, code, err);
    throw err;
  }
}

/** Story 69: the plan of a sao chép, per hồ sơ, Phiếu chấm and Tiêu chí; writes nothing. */
export function previewAdvisoryCopy(deps: CoreDeps) {
  return async (actor: Actor, input: PreviewAdvisoryCopyInput): Promise<{ dossiers: AdvisoryCopyPlan[] }> => {
    authorize(actor, "scoring.advisory_copy");
    validScope(input);
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const out: AdvisoryCopyPlan[] = [];
      for (const d of uniqueById(input.dossiers)) {
        out.push(
          await forDossier(d.dossierId, async (named) => {
            assertIdShape(d.dossierId, dossierNotFound);
            const dossier = await tx.dossiers.findById(scope, d.dossierId);
            if (!dossier) throw dossierNotFound();
            named(dossier);
            assertCopyRow(actor, dossier);
            await assertAdvisoryMode(tx, dossier);
            return (await planOf(tx, dossier, input, d.advisoryVersionId)).plan;
          }),
        );
      }
      return { dossiers: out };
    });
  };
}

/**
 * Stories 65 to 76: the sao chép itself, all hồ sơ and recipients in one transaction. Each hồ sơ goes through
 * transition() with the version the Thành viên Tổ tư vấn saw, so one changed meanwhile refuses the whole lô and
 * is named. One audit row per hồ sơ (the transition's) holds the phiên bản, scope, recipients and result; the
 * recipients with a dòng written are told (story 75).
 */
export function copyAdvisory(deps: CoreDeps) {
  return async (actor: Actor, input: CopyAdvisoryInput): Promise<{ dossiers: (AdvisoryCopyPlan & { version: number; state: DossierState })[] }> => {
    authorize(actor, "scoring.advisory_copy");
    validScope(input);
    const picks = uniqueById(input.dossiers);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const done = new Map<string, AdvisoryCopyPlan & { version: number; state: DossierState }>();
      // Locked in id order, so two lô over the same hồ sơ queue rather than deadlock.
      for (const d of [...picks].sort((a, b) => a.dossierId.localeCompare(b.dossierId))) {
        const result = await forDossier(d.dossierId, async (named) => {
          const before = await lockDossier(tx, actor, d.dossierId);
          named(before);
          assertCopyRow(actor, before);
          await assertAdvisoryMode(tx, before);
          if (d.expectedVersion !== before.version) throw versionConflict();
          const { plan, writes } = await planOf(tx, before, input, d.advisoryVersionId);
          const after = await transition(deps, tx, actor, before, {
            action: "dossier.advisory_copy",
            expectedVersion: d.expectedVersion,
            metadata: {
              advisoryVersionId: plan.advisoryVersion.id,
              advisoryVersionNumber: plan.advisoryVersion.number,
              criteria: input.criteria === "all" ? "all" : plan.criteria,
              recipients: plan.recipients.map((r) => ({ userId: r.userId, sheet: r.sheet, written: r.written, edited: r.edited })),
              written: plan.written,
            },
            notify: plan.recipients.filter((r) => r.written.length > 0).map((r) => r.userId),
          });
          for (const w of writes) {
            for (const line of w.lines) await tx.scoreSheets.saveLine({ ...line, updatedAt: now });
            // A thành viên's form open meanwhile gets a version conflict rather than writing over the sao chép.
            if (!(await tx.scoreSheets.update({ ...w.sheet, awaitingCopy: false, version: w.sheet.version + 1, updatedAt: now }, w.sheet.version))) throw versionConflict();
          }
          return { ...plan, version: after.version, state: after.state };
        });
        done.set(result.dossierId, result);
      }
      return { dossiers: picks.map((d) => done.get(d.dossierId)!) };
    });
  };
}

function uniqueById<T extends { dossierId: string }>(items: T[]): T[] {
  return [...new Map(items.map((d) => [d.dossierId, d])).values()];
}

export interface AdvisoryCopyBoardRow {
  dossierId: string;
  code: string;
  productName: string;
  state: DossierState;
  dossierVersion: number;
  versions: { id: string; number: number }[];
  /** The highest phiên bản copied into any current Phiếu chấm; null before the first sao chép (S53 bước 1). */
  copiedNumber: number | null;
  members: { userId: string; fullName: string; sheet: ScoreSheet["state"] | null }[];
  criteria: { code: string; name: string; partCode: string }[];
}

/** S53 bước 1: the hồ sơ the reader is Phân công on as Tổ tư vấn with an issued phiên bản, in a đợt dựa trên Tổ tư vấn. */
export function advisoryCopyBoard(deps: CoreDeps) {
  return async (actor: Actor): Promise<AdvisoryCopyBoardRow[]> => {
    authorize(actor, "scoring.advisory_copy");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const out: AdvisoryCopyBoardRow[] = [];
      for (const dossier of await tx.dossiers.list(scope, {})) {
        if (!ruleFor("dossier.advisory_copy", dossier.state)) continue;
        const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
        if (round?.gradingMode !== "advisory_based") continue;
        const versions = await tx.advisoryReports.versions(dossier.id);
        if (versions.length === 0) continue;
        const sheets = await tx.scoreSheets.current(dossier.id);
        const numberOf = new Map(versions.map((v) => [v.id, v.number]));
        let copiedNumber: number | null = null;
        for (const s of sheets) {
          for (const l of await tx.scoreSheets.lines(s.id)) {
            const n = l.advisoryVersionId ? numberOf.get(l.advisoryVersionId) : undefined;
            if (n !== undefined && (copiedNumber === null || n > copiedNumber)) copiedNumber = n;
          }
        }
        const members = [];
        for (const a of (await tx.assignments.current(dossier.id)).filter(isMemberInForce)) {
          members.push({ userId: a.userId, fullName: (await tx.users.findById(a.userId))?.fullName ?? "", sheet: sheets.find((s) => s.assignmentId === a.id)?.state ?? null });
        }
        out.push({
          dossierId: dossier.id,
          code: dossier.code,
          productName: dossier.productName,
          state: dossier.state,
          dossierVersion: dossier.version,
          versions: versions.map((v) => ({ id: v.id, number: v.number })),
          copiedNumber,
          members: members.sort((x, y) => x.fullName.localeCompare(y.fullName, "vi")),
          criteria: sheetOrder(await setRowsOf(tx, dossier)).map((c) => ({ code: c.code, name: c.name, partCode: c.partCode })),
        });
      }
      return out;
    });
  };
}
