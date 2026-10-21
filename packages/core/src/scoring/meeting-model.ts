import type { RankThresholds } from "../criteria/model";
import type { AggregateScores } from "./aggregate";
import type { ScoreSheetState } from "./score-sheet-model";

/*
 * Phiên họp and kết quả chốt (L15 HD-08, HD-09; spec #49 "Phiên họp và văn bản họp", "Chốt điểm"; GLOSSARY.md).
 * A Phiên họp of a Hội đồng in a đợt lists the hồ sơ to chốt; a hồ sơ waits in one open Phiên họp at a time.
 * Chốt writes a kết quả chốt, numbered 1, 2, … per hồ sơ (a Mở khóa sau chốt supersedes it, ADR 0008).
 */

export const MEETING_STATES = ["open", "closed"] as const;
export type MeetingState = (typeof MEETING_STATES)[number];

export interface Meeting {
  id: string;
  councilId: string;
  roundId: string;
  title: string;
  /** Ngày họp, a calendar date (YYYY-MM-DD). */
  heldOn: string;
  location: string;
  state: MeetingState;
  createdBy: string;
  createdAt: Date;
  closedBy: string | null;
  closedAt: Date | null;
}

/** A hồ sơ of a Phiên họp: pending until chốt sets `resultId`. */
export interface MeetingDossier {
  meetingId: string;
  dossierId: string;
  addedBy: string;
  addedAt: Date;
  resultId: string | null;
}

/** A biên bản đã ký số of a Phiên họp (#62, story 115): numbered 1, 2, … per Phiên họp, never changed. */
export interface MeetingMinutes {
  id: string;
  meetingId: string;
  number: number;
  fileId: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface MeetingRepo {
  insert(m: Meeting): Promise<void>;
  update(m: Meeting): Promise<void>;
  findById(id: string): Promise<Meeting | null>;
  /** Like findById, holding a row lock until the transaction ends. */
  lock(id: string): Promise<Meeting | null>;
  /** The Phiên họp of a Hội đồng, newest ngày họp first, optionally of one đợt. */
  list(councilId: string, roundId?: string): Promise<Meeting[]>;
  dossiers(meetingId: string): Promise<MeetingDossier[]>;
  /** The row where the hồ sơ waits for chốt, if any (it is in an open Phiên họp). */
  pendingOf(dossierId: string): Promise<MeetingDossier | null>;
  /** False when the hồ sơ already waits in a Phiên họp (the DB keeps one pending row per hồ sơ). */
  addDossier(row: MeetingDossier): Promise<boolean>;
  /** Gỡ a pending hồ sơ; false when it is not pending there. */
  removeDossier(meetingId: string, dossierId: string): Promise<boolean>;
  markFinalized(meetingId: string, dossierId: string, resultId: string): Promise<void>;
  /** The biên bản đã ký of a Phiên họp, newest number first. */
  minutes(meetingId: string): Promise<MeetingMinutes[]>;
  /** False when the file is already a biên bản. */
  insertMinutes(m: MeetingMinutes): Promise<boolean>;
}

/** One thành viên chấm as the kết quả chốt keeps them. */
export interface SnapshotGrader {
  userId: string;
  fullName: string;
  sheetId: string | null;
  attempt: number | null;
  state: ScoreSheetState | null;
  confirmedAt: string | null;
  reauthMethod: "totp" | "password" | null;
  total: number | null;
  lines: { criterionId: string; levelId: string | null; points: number; comment: string; adjustReason: string | null; source: "member" | "advisory" }[] | null;
}

/**
 * Everything a kết quả chốt rests on (story 119), stored as JSONB and hashed as canonical JSON (`snapshotHash`):
 * the phiếu counted with their dòng, the Vắng, the Phiên bản tiêu chí and Bộ tiêu chí, the Ngưỡng hạng, the Quy tắc
 * tổng hợp, the newest phiên bản Báo cáo Tổ tư vấn, and the result. Plain JSON values only.
 */
export interface FinalizedSnapshot {
  n: number;
  dossier: { id: string; code: string; productName: string };
  meeting: { id: string; title: string; heldOn: string };
  criteriaVersionId: string;
  criteriaSetId: string;
  thresholds: RankThresholds;
  aggregation: { method: string; minGraders: number; deviationFlagPoints: number };
  advisoryReportVersion: { id: string; number: number } | null;
  graders: SnapshotGrader[];
  absent: { sheetId: string; userId: string; fullName: string }[];
  aggregate: AggregateScores;
  finalizedAt: string;
  finalizedBy: { userId: string; fullName: string };
  reauthMethod: "totp" | "password";
}

export interface AggregateResult {
  id: string;
  dossierId: string;
  n: number;
  meetingId: string;
  criteriaVersionId: string;
  total: number;
  star: number;
  parts: AggregateScores["parts"];
  averages: Record<string, number>;
  unmet: AggregateScores["unmet"];
  deviation: number;
  flagged: boolean;
  countedSheetIds: string[];
  absentSheetIds: string[];
  snapshot: FinalizedSnapshot;
  sha256: string;
  finalizedBy: string;
  finalizedAt: Date;
  reauthMethod: "totp" | "password";
  supersededAt: Date | null;
  supersededByUnlock: string | null;
}

export interface AggregateResultRepo {
  insert(r: AggregateResult): Promise<void>;
  /** The kết quả hiện hành (not superseded) of a hồ sơ already loaded within scope. */
  current(dossierId: string): Promise<AggregateResult | null>;
  /** Every kết quả chốt of a hồ sơ, n ascending. */
  list(dossierId: string): Promise<AggregateResult[]>;
  /** Marks a kết quả hiện hành superseded by a Mở khóa (#63); false when it already was. */
  supersede(resultId: string, at: Date, unlockId: string): Promise<boolean>;
  /** Appends a Mở khóa sau chốt request; the DB refuses any later change. */
  insertUnlock(u: UnlockRequest): Promise<void>;
  /** The Mở khóa sau chốt requests of a hồ sơ, oldest first. */
  unlocks(dossierId: string): Promise<UnlockRequest[]>;
}

/**
 * Mở khóa sau chốt (L15, #63, ADR 0008): Quản trị's record of why the kết quả `resultId` was superseded: the
 * văn bản yêu cầu of the Hội đồng, who asked (as written on it) and the lý do.
 */
export interface UnlockRequest {
  id: string;
  dossierId: string;
  resultId: string;
  requestFileId: string;
  requestedBy: string;
  reason: string;
  unlockedBy: string;
  unlockedAt: Date;
  reauthMethod: "totp" | "password";
}
