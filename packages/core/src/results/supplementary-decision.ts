import { auditEntry } from "../audit/audit";
import type { MeetingDocumentRow, RecognitionDecisionData } from "../documents/renderer";
import { renderDocument } from "../documents/templates";
import { lockDossier } from "../dossiers/edit";
import { dossierNotFound } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { ownUpload } from "../files/attach";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import { DomainError } from "../shared/errors";
import { formatDayVn, formatDecimalVn } from "../shared/format";
import { assertIdShape } from "../shared/ids";
import { issueCertificates } from "./certificate";
import { decisionView, numberOf, signedOnOf, type DecisionView, type RecordedDecision } from "./decision";
import { DECISION_SECTION_LABEL, decisionDraftSections, recognizedStar, type RecognitionDecision, type RecognitionDecisionDossier } from "./decision-model";

/*
 * L17 Quyết định công nhận bổ sung (#88, spec #79 stories 56, 57; ADR 0009). No Phiên họp: the Cán bộ Sở picks the hồ
 * sơ Đã gửi đề nghị 5 sao the Bộ trả về (cờ chờ), each named in mục 4 sao. Ghi nhận turns each into Công nhận 3/4 sao
 * with Hạng công nhận 4, clears its cờ chờ and issues its Giấy chứng nhận 4 sao, numbered from the same cert_counter as a
 * quyết định theo Phiên họp. The kết quả chốt is untouched. Its số and ngày ký are corrected with amendDecision.
 */

export interface SupplementaryDecisionInput {
  /** The hồ sơ chờ Quyết định công nhận bổ sung it names. */
  dossierIds: string[];
  number: string;
  /** Ngày ký, YYYY-MM-DD; not after today in Vietnam. */
  signedOn: string;
  /** The signed PDF the Cán bộ Sở uploaded with purpose `recognition_decision`. */
  fileId: string;
}

/** The hồ sơ picked, once each, sorted by id so concurrent callers lock in the same order. */
export function pickedDossiers(value: unknown): string[] {
  const ids = Array.isArray(value) ? [...new Set(value)] : [];
  if (ids.length === 0) throw new DomainError("dossiers_required", "Chọn ít nhất một hồ sơ chờ Quyết định công nhận bổ sung");
  for (const id of ids) assertIdShape(id, dossierNotFound);
  return (ids as string[]).sort((a, b) => a.localeCompare(b));
}

/** Story 57: ghi nhận the signed Quyết định công nhận bổ sung. */
export function recordSupplementaryDecision(deps: CoreDeps) {
  return async (actor: Actor, input: SupplementaryDecisionInput): Promise<RecordedDecision> => {
    authorize(actor, "results.decision.record");
    const number = numberOf(input.number);
    const now = deps.clock.now();
    const signedOn = signedOnOf(input.signedOn, vnDateOf(now));
    const dossierIds = pickedDossiers(input.dossierIds);
    return deps.uow.run(async (tx) => {
      const file = await ownUpload(
        tx,
        actor,
        input.fileId,
        "recognition_decision",
        () => new DomainError("file_required", "Tải lên bản Quyết định công nhận bổ sung đã ký (PDF)"),
      );
      const decision: RecognitionDecision = {
        id: deps.ids.next(),
        kind: "supplementary",
        meetingId: null,
        number,
        signedOn,
        fileId: file.id,
        recordedBy: actor.userId,
        recordedAt: now,
      };
      const recognized: { dossierId: string; recognizedStar: number }[] = [];
      for (const dossierId of dossierIds) {
        const before = await lockDossier(tx, actor, dossierId);
        // The kết quả chốt hiện hành as stored, never recomputed (CLAUDE.md "Hạng sao").
        const result = await tx.aggregateResults.current(before.id);
        const star = result && recognizedStar(result, before.awaitingSupplementaryDecision);
        await transition(deps, tx, actor, before, {
          action: "dossier.recognize_supplementary",
          expectedVersion: before.version,
          patch: { awaitingSupplementaryDecision: false },
          metadata: { decisionId: decision.id, section: "four_star", number, signedOn },
        });
        if (star !== 4) throw new Error(`dossier ${before.id} chờ quyết định bổ sung has no kết quả chốt 5 sao`);
        recognized.push({ dossierId, recognizedStar: star });
      }
      const rows: RecognitionDecisionDossier[] = dossierIds.map((dossierId) => ({ decisionId: decision.id, dossierId, section: "four_star" }));
      await tx.recognitionDecisions.insert(decision, rows);
      await issueCertificates(deps, tx, actor, decision, recognized);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.decision.recorded",
          targetType: "recognition_decision",
          targetId: decision.id,
          after: { kind: decision.kind, number, signedOn, fileId: file.id },
          metadata: { dossiers: rows.map(({ dossierId, section }) => ({ dossierId, section })) },
        }),
      );
      return { decisionId: decision.id, dossiers: rows.map(({ dossierId, section }) => ({ dossierId, section })) };
    });
  };
}

const notAwaiting = () =>
  new DomainError("not_awaiting_supplementary_decision", "Hồ sơ chưa được chuyển về công nhận cấp tỉnh nên không có trong Quyết định công nhận bổ sung");

type DraftRow = MeetingDocumentRow & { roundId: string | null };

/** One row of the dự thảo: the hồ sơ chờ in mục 4 sao, its Hạng sao 5 of the kết quả chốt in the ghi chú. */
async function draftRow(tx: Tx, actor: UserActor, dossierId: string): Promise<DraftRow> {
  const d = await tx.dossiers.findById(dataScopeOf(actor), dossierId);
  if (!d) throw dossierNotFound();
  if (d.state !== "five_star_proposed" || !d.awaitingSupplementaryDecision) throw notAwaiting();
  const result = await tx.aggregateResults.current(d.id);
  const star = result && recognizedStar(result, true);
  if (!result || star !== 4) throw notAwaiting();
  const snap = (await tx.dossiers.latestSubmission(d.id))?.snapshot;
  return {
    index: "",
    code: d.code,
    entityName: snap?.entity.name ?? "",
    address: snap?.entity.address ?? "",
    productName: d.productName,
    criteriaSet: snap ? `${snap.criteriaSet.code} - ${snap.criteriaSet.name}` : "",
    graders: [],
    total: formatDecimalVn(result.total),
    star: `${star} sao`,
    flag: "",
    unmet: "",
    absent: "",
    advisorySummary: "",
    status: "Đã chốt",
    note: `${DECISION_SECTION_LABEL.four_star}. Hạng sao theo kết quả chốt: ${result.star} sao; Trung ương chuyển về công nhận cấp tỉnh`,
    generalComment: d.generalComment ?? "",
    roundId: d.roundId,
  };
}

/**
 * Story 56: the dự thảo Quyết định công nhận bổ sung of the hồ sơ chờ picked, from the mẫu đang dùng of
 * `recognition_decision_draft` with the cờ `supplementary`; as DOCX, never stored, nothing changes.
 */
export function supplementaryDecisionDraft(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierIds: string[] }): Promise<{ fileName: string; bytes: Uint8Array }> => {
    authorize(actor, "results.decision.record");
    const dossierIds = pickedDossiers(input.dossierIds);
    return deps.uow.run(async (tx) => {
      const rows: DraftRow[] = [];
      for (const id of dossierIds) rows.push(await draftRow(tx, actor, id));
      rows.sort((a, b) => a.code.localeCompare(b.code));
      const rounds: string[] = [];
      for (const roundId of new Set(rows.flatMap((r) => (r.roundId ? [r.roundId] : [])))) rounds.push((await tx.rounds.findById(roundId))?.name ?? "");
      const now = deps.clock.now();
      const { sections, recognized } = decisionDraftSections(rows.map(({ roundId: _r, ...row }) => ({ section: "four_star" as const, row })));
      const data: RecognitionDecisionData = {
        supplementary: true,
        councilName: "",
        roundName: rounds.filter(Boolean).join(", "),
        meetingTitle: "",
        heldOn: "",
        location: "",
        status: "Hồ sơ đã gửi đề nghị Trung ương đánh giá 5 sao, được chuyển về công nhận cấp tỉnh hạng 4 sao.",
        count: String(recognized.length),
        dossiers: recognized,
        sections,
        generatedOn: formatDayVn(vnDateOf(now)),
      };
      const { bytes, templateVersionId } = await renderDocument(deps, tx, "recognition_decision_draft", data);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.supplementary_decision.draft_generated",
          targetType: "dossier_list",
          targetId: null,
          metadata: { dossiers: dossierIds, templateVersionId },
        }),
      );
      return { fileName: `Dự thảo quyết định công nhận bổ sung ${vnDateOf(now)}.docx`, bytes };
    });
  };
}

export interface SupplementaryDecisionView extends DecisionView {
  dossiers: { dossierId: string; code: string; productName: string }[];
}

/** The Quyết định công nhận bổ sung recorded, newest first, each with its hồ sơ (to download or correct it). */
export function supplementaryDecisions(deps: CoreDeps) {
  return async (actor: Actor): Promise<SupplementaryDecisionView[]> => {
    authorize(actor, "results.decision.record");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const out: SupplementaryDecisionView[] = [];
      for (const decision of await tx.recognitionDecisions.ofKind("supplementary")) {
        const dossiers: SupplementaryDecisionView["dossiers"] = [];
        for (const row of await tx.recognitionDecisions.dossiers(decision.id)) {
          const d = await tx.dossiers.findById(scope, row.dossierId);
          if (d) dossiers.push({ dossierId: d.id, code: d.code, productName: d.productName });
        }
        dossiers.sort((a, b) => a.code.localeCompare(b.code));
        out.push({ ...(await decisionView(tx, decision)), dossiers });
      }
      return out;
    });
  };
}
