import { auditEntry } from "../audit/audit";
import type { RankThresholds } from "../criteria/model";
import type { DocumentTemplate, MeetingDocumentData, MeetingDocumentRow } from "../documents/renderer";
import { dossierNotFound } from "../dossiers/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { formatDayVn, formatDecimalVn } from "../shared/format";
import type { Tx } from "../shared/uow";
import type { AggregateScores } from "./aggregate";
import type { Meeting } from "./meeting-model";
import { ownMeeting } from "./meetings";
import { aggregateOf } from "./read";
import type { ScoreSheetState } from "./score-sheet-model";

/*
 * L15 HD-09, TM-11 (#62, spec #49 stories 110 to 115): the văn bản họp of a Phiên họp, sinh from the mẫu tạm
 * (bảng tổng hợp điểm, dự thảo biên bản, dự thảo quyết định công nhận) and returned as DOCX, never stored. A hồ sơ
 * chốt in this Phiên họp prints its kết quả chốt as stored; one still waiting prints the điểm tính tại chỗ, so
 * sinh lại after chốt gives the số liệu cuối (story 113). The biên bản đã ký số are PDF uploads, numbered, kept.
 */

export const MEETING_DOCUMENT_KINDS = ["score_table", "minutes", "decision"] as const;
export type MeetingDocumentKind = (typeof MEETING_DOCUMENT_KINDS)[number];

const TEMPLATE: Record<MeetingDocumentKind, DocumentTemplate> = {
  score_table: "meeting_score_table",
  minutes: "meeting_minutes_draft",
  decision: "recognition_decision_draft",
};

export const MEETING_DOCUMENT_LABEL: Record<MeetingDocumentKind, string> = {
  score_table: "Bảng tổng hợp điểm",
  minutes: "Dự thảo biên bản họp",
  decision: "Dự thảo quyết định công nhận",
};

const starLabel = (star: number) => `${star} sao${star < 3 ? " (không đạt)" : ""}`;

function pointsLabel(state: ScoreSheetState | null, total: number | null): string {
  if (state === "confirmed" && total !== null) return formatDecimalVn(total);
  return state === "absent" ? "Vắng" : "Chưa xác nhận";
}

interface Row extends MeetingDocumentRow {
  starValue: number;
  totalValue: number;
  thresholds: RankThresholds;
}

async function rowsOf(tx: Tx, actor: UserActor, meeting: Meeting): Promise<{ rows: Row[]; pending: number }> {
  const scope = dataScopeOf(actor);
  const rows: Row[] = [];
  let pending = 0;
  for (const md of await tx.meetings.dossiers(meeting.id)) {
    const d = await tx.dossiers.findById(scope, md.dossierId);
    if (!d) throw dossierNotFound();
    const submission = await tx.dossiers.latestSubmission(d.id);
    const versions = await tx.advisoryReports.versions(d.id);
    const result = md.resultId ? (await tx.aggregateResults.list(d.id)).find((r) => r.id === md.resultId) : undefined;
    let graders: { fullName: string; state: ScoreSheetState | null; total: number | null }[];
    let aggregate: AggregateScores;
    let thresholds: RankThresholds;
    let absent: string;
    let advisory = versions.at(-1) ?? null;
    if (result) {
      ({ graders, aggregate, thresholds } = result.snapshot);
      absent = result.snapshot.absent.map((a) => a.fullName).join(", ") || "Không";
      const used = result.snapshot.advisoryReportVersion;
      advisory = used ? (versions.find((v) => v.id === used.id) ?? null) : null;
    } else {
      pending += 1;
      ({ graders, aggregate, thresholds } = await aggregateOf(tx, d));
      const unconfirmed = graders.filter((g) => g.state !== "confirmed").map((g) => g.fullName);
      absent = unconfirmed.length ? `chưa chốt; chưa xác nhận phiếu: ${unconfirmed.join(", ")}` : "Không";
    }
    const snap = submission?.snapshot;
    rows.push({
      index: "",
      code: d.code,
      entityName: snap?.entity.name ?? "",
      address: snap?.entity.address ?? "",
      productName: d.productName,
      criteriaSet: snap ? `${snap.criteriaSet.code} - ${snap.criteriaSet.name}` : "",
      graders: graders.map((g) => ({ fullName: g.fullName, points: pointsLabel(g.state, g.total) })),
      total: formatDecimalVn(aggregate.total),
      star: starLabel(aggregate.star),
      flag: aggregate.flagged ? `Lệch điểm lớn (${formatDecimalVn(aggregate.deviation)} điểm)` : "",
      unmet: aggregate.unmet.map((u) => `${u.code} (${u.star} sao cần ${formatDecimalVn(u.required)}, đạt ${formatDecimalVn(u.actual)})`).join("; ") || "Không",
      absent,
      advisorySummary: advisory ? `${advisory.snapshot.summary} (Báo cáo Tổ tư vấn phiên bản ${advisory.number})` : "Không có Báo cáo Tổ tư vấn",
      status: result ? "Đã chốt" : "Tạm tính",
      note: aggregate.total >= thresholds[5] ? "Đề nghị xét 5 sao" : "",
      starValue: aggregate.star,
      totalValue: aggregate.total,
      thresholds,
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return { rows, pending };
}

const reindex = (rows: Row[]): MeetingDocumentRow[] =>
  rows.map(({ starValue: _s, totalValue: _t, thresholds: _th, ...r }, i) => ({ ...r, index: String(i + 1) }));

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").trim();

/** Stories 110 to 114: one văn bản họp of a Phiên họp of the actor's Hội đồng, as DOCX; nothing is stored. */
export function generateMeetingDocument(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string; kind: MeetingDocumentKind }): Promise<{ fileName: string; bytes: Uint8Array }> => {
    authorize(actor, "scoring.meeting.document");
    if (!MEETING_DOCUMENT_KINDS.includes(input.kind)) throw new DomainError("document_kind_invalid", "Loại văn bản không hợp lệ");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, false);
      const { rows, pending } = await rowsOf(tx, actor, meeting);
      const council = await tx.councils.findById(meeting.councilId);
      const round = await tx.rounds.findById(meeting.roundId);
      const now = deps.clock.now();
      const listed = input.kind === "decision" ? rows.filter((r) => r.starValue >= 3) : rows;
      const data: MeetingDocumentData = {
        councilName: council?.name ?? "",
        roundName: round?.name ?? "",
        meetingTitle: meeting.title,
        heldOn: formatDayVn(meeting.heldOn),
        location: meeting.location,
        status:
          pending === 0
            ? "Số liệu đã chốt của toàn bộ hồ sơ trong Phiên họp."
            : `Bản nháp: còn ${pending} hồ sơ chưa chốt điểm, số liệu của các hồ sơ này là tạm tính.`,
        count: String(listed.length),
        dossiers: reindex(listed),
        generatedOn: formatDayVn(vnDateOf(now)),
      };
      const bytes = await deps.documents.render(TEMPLATE[input.kind], data);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "scoring.meeting.document_generated",
          targetType: "meeting",
          targetId: meeting.id,
          metadata: { kind: input.kind, dossiers: listed.length, pending },
        }),
      );
      return { fileName: `${MEETING_DOCUMENT_LABEL[input.kind]} - ${safeName(meeting.title)}.docx`, bytes };
    });
  };
}
