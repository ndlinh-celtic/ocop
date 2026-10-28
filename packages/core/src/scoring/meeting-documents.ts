import { ownUpload } from "../files/attach";
import { auditEntry } from "../audit/audit";
import type { DocumentTemplate, MeetingDocumentData, MeetingDocumentRow } from "../documents/renderer";
import { renderDocument } from "../documents/templates";
import { dossierNotFound } from "../dossiers/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { emit } from "../platform/emit";
import { formatDayVn, formatDecimalVn } from "../shared/format";
import type { Tx } from "../shared/uow";
import type { AggregateScores } from "./aggregate";
import type { Meeting } from "./meeting-model";
import { chotResultOf, ownMeeting } from "./meetings";
import { DECISION_SECTION_LABEL } from "../results/decision-model";
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
  dossierId: string;
  /** Whether the row prints a thành viên's points by name (a phiếu đã xác nhận). */
  showsPoints: boolean;
}

/** The văn bản that print each thành viên chấm with their points; the dự thảo quyết định prints the tổng hợp alone. */
const NAMES_GRADERS: readonly MeetingDocumentKind[] = ["score_table", "minutes"];

async function rowsOf(tx: Tx, actor: UserActor, meeting: Meeting): Promise<{ rows: Row[]; pending: number }> {
  const scope = dataScopeOf(actor);
  const rows: Row[] = [];
  let pending = 0;
  for (const md of await tx.meetings.dossiers(meeting.id)) {
    const d = await tx.dossiers.findById(scope, md.dossierId);
    if (!d) throw dossierNotFound();
    const submission = await tx.dossiers.latestSubmission(d.id);
    const versions = await tx.advisoryReports.versions(d.id);
    const result = await chotResultOf(tx, md);
    let graders: { fullName: string; state: ScoreSheetState | null; total: number | null }[];
    let aggregate: AggregateScores;
    let absent: string;
    let advisory = versions.at(-1) ?? null;
    if (result) {
      ({ graders, aggregate } = result.snapshot);
      absent = result.snapshot.absent.map((a) => a.fullName).join(", ") || "Không";
      const used = result.snapshot.advisoryReportVersion;
      advisory = used ? (versions.find((v) => v.id === used.id) ?? null) : null;
    } else {
      pending += 1;
      ({ graders, aggregate } = await aggregateOf(tx, d));
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
      // A kết quả a Mở khóa superseded is not printed: the hồ sơ is tạm tính until chốt again (ADR 0008).
      status: result ? "Đã chốt" : md.resultId ? "Đã mở khóa, chờ chốt lại" : "Tạm tính",
      // By Hạng sao, not điểm: a hồ sơ from 90 điểm whose Sao tối thiểu of 5 sao is unmet is 4 sao (CLAUDE.md "Hạng sao").
      // Mục (3) of the quyết định (#83, spec #79): it approves the kết quả, it recognizes nothing.
      note: aggregate.star === 5 ? DECISION_SECTION_LABEL.five_star_proposal : "",
      generalComment: d.generalComment ?? "",
      starValue: aggregate.star,
      dossierId: d.id,
      showsPoints: graders.some((g) => g.state === "confirmed" && g.total !== null),
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return { rows, pending };
}

const reindex = (rows: Row[]): MeetingDocumentRow[] =>
  rows.map(({ starValue: _s, dossierId: _d, showsPoints: _p, ...r }, i) => ({ ...r, index: String(i + 1) }));

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
      const { bytes } = await renderDocument(deps, tx, TEMPLATE[input.kind], data);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "scoring.meeting.document_generated",
          targetType: "meeting",
          targetId: meeting.id,
          metadata: { kind: input.kind, dossiers: listed.length, pending },
        }),
      );
      // Each thành viên's points by name, as in the `full` view (CODING_STANDARDS.md "Truy cập dữ liệu cá nhân"), per hồ sơ.
      if (NAMES_GRADERS.includes(input.kind)) {
        for (const r of listed.filter((r) => r.showsPoints)) {
          await tx.audit.append(
            auditEntry(actor, deps.ids.next(), now, {
              action: "personal_data.viewed",
              targetType: "dossier",
              targetId: r.dossierId,
              metadata: { view: "meeting_document", kind: input.kind, meetingId: meeting.id },
            }),
          );
        }
      }
      return { fileName: `${MEETING_DOCUMENT_LABEL[input.kind]} - ${safeName(meeting.title)}.docx`, bytes };
    });
  };
}

const minutesNotFound = () => new DomainError("not_found", "Không tìm thấy biên bản");

/**
 * Story 115: ties a biên bản đã ký số the Thư ký has uploaded (purpose `meeting_minutes`, PDF) to the Phiên họp as the
 * next number. A file still being scanned may be attached (it downloads once clean); a blocked one never. Not needed to chốt.
 */
export function attachMeetingMinutes(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string; fileId: string }): Promise<{ number: number }> => {
    authorize(actor, "scoring.meeting.minutes.upload");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, true);
      const file = await ownUpload(tx, actor, input.fileId, "meeting_minutes", minutesNotFound);
      const number = ((await tx.meetings.minutes(meeting.id))[0]?.number ?? 0) + 1;
      const now = deps.clock.now();
      if (
        !(await tx.meetings.insertMinutes({ id: deps.ids.next(), meetingId: meeting.id, number, fileId: file.id, uploadedBy: actor.userId, uploadedAt: now }))
      ) {
        throw new DomainError("already_attached", "Tệp này đã là một biên bản của Phiên họp");
      }
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "scoring.meeting.minutes_attached",
          targetType: "meeting",
          targetId: meeting.id,
          metadata: { number, fileId: file.id },
        }),
      );
      await emit(deps, tx, {
        type: "scoring.meeting_minutes_attached",
        payload: { meetingId: meeting.id, councilId: meeting.councilId, number, fileId: file.id },
      });
      return { number };
    });
  };
}

/** A short-lived link to one biên bản đã ký of a Phiên họp of the actor's Hội đồng, once scanned clean. */
export function downloadMeetingMinutes(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string; number: number }): Promise<{ url: string; expiresAt: Date; fileName: string }> => {
    authorize(actor, "scoring.meeting.document");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, false);
      const row = (await tx.meetings.minutes(meeting.id)).find((m) => m.number === input.number);
      const file = row && (await tx.files.findById(row.fileId));
      if (!file) throw minutesNotFound();
      if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa sẵn sàng để tải xuống");
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "file.download_issued",
          targetType: "file",
          targetId: file.id,
          metadata: { meetingId: meeting.id, document: "meeting_minutes", number: row.number },
        }),
      );
      return { url: get.url, expiresAt: get.expiresAt, fileName: file.fileName };
    });
  };
}
