import { DomainError } from "../shared/errors";

/**
 * Đợt đánh giá (L07, spec #16). Trạng thái đợt:
 *   draft (Nháp) → open_for_submission (Đang nhận nộp) → submission_closed (Đã đóng nộp) → ended (Đã kết thúc).
 * Extending Hạn nộp xã of a submission_closed round brings it back to open_for_submission (#26).
 * At most one round is open_for_submission at any time (domain check plus a partial unique index).
 */
export const ROUND_STATUSES = ["draft", "open_for_submission", "submission_closed", "ended"] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "Nháp",
  open_for_submission: "Đang nhận nộp",
  submission_closed: "Đã đóng nộp",
  ended: "Đã kết thúc",
};

/** Chế độ chấm: chấm trực tiếp, or dựa trên Tổ tư vấn. */
export const GRADING_MODES = ["direct", "advisory_based"] as const;
export type GradingMode = (typeof GRADING_MODES)[number];

export const GRADING_MODE_LABEL: Record<GradingMode, string> = {
  direct: "Chấm trực tiếp",
  advisory_based: "Dựa trên Tổ tư vấn",
};

/** Cách tổng hợp; only the mean for now (open assumption in CLAUDE.md). */
export const AGGREGATION_METHODS = ["mean"] as const;
export type AggregationMethod = (typeof AGGREGATION_METHODS)[number];

/** Quy tắc tổng hợp of a round; locked once the round has its first phiếu chấm (#27). */
export interface AggregationRule {
  method: AggregationMethod;
  /** Số người chấm tối thiểu per hồ sơ. */
  minGraders: number;
  /** Ngưỡng cờ chênh lệch, in points. */
  deviationFlagPoints: number;
}

export interface RoundDeadlines {
  /** Hạn nộp xã: past it, submission closes (#25). */
  submissionDeadline: Date;
  /** Hạn gửi tỉnh. */
  forwardingDeadline: Date;
  /** Hạn đánh giá tỉnh: a reminder only. */
  evaluationDeadline: Date;
}

export interface Round extends RoundDeadlines {
  id: string;
  name: string;
  year: number;
  status: RoundStatus;
  /** The published Phiên bản tiêu chí the round applies; fixed once opened. */
  criteriaVersionId: string;
  gradingMode: GradingMode;
  aggregation: AggregationRule;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  openedAt: Date | null;
  openedBy: string | null;
  submissionClosedAt: Date | null;
  endedAt: Date | null;
  endedBy: string | null;
}

export interface RoundRepo {
  insert(round: Round): Promise<void>;
  /** Writes every field of the round. Throws `round_already_open` if the one-open index refuses it. */
  update(round: Round): Promise<void>;
  /** Draft rounds only; the DB refuses the rest. */
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Round | null>;
  /** Like findById, but holds a row lock until the transaction ends (SELECT … FOR UPDATE). */
  lock(id: string): Promise<Round | null>;
  /** Newest year first, then newest created. */
  list(): Promise<Round[]>;
  /** The round Đang nhận nộp, if any. */
  findOpen(): Promise<Round | null>;
  /**
   * Rounds Đang nhận nộp whose Hạn nộp xã is strictly before `now`, oldest deadline first, row-locked
   * until the transaction ends (SELECT … FOR UPDATE). A concurrent run waits, then skips rows it closed.
   */
  lockDueForClosing(now: Date): Promise<Round[]>;
  /** Appends one row of Gia hạn đợt history (append-only in the DB). */
  insertExtension(extension: DeadlineExtension): Promise<void>;
  /** The Gia hạn đợt history of a round, newest first, with the name of who extended. */
  listExtensions(roundId: string): Promise<DeadlineExtensionView[]>;
}

/** The deadlines a Gia hạn đợt may move: Hạn nộp xã and Hạn gửi tỉnh (Hạn đánh giá tỉnh is a reminder only). */
export const EXTENDABLE_DEADLINES = ["submission", "forwarding"] as const;
export type ExtendableDeadline = (typeof EXTENDABLE_DEADLINES)[number];

export const EXTENDABLE_DEADLINE_LABEL: Record<ExtendableDeadline, string> = {
  submission: "Hạn nộp xã",
  forwarding: "Hạn gửi tỉnh",
};

/** One Gia hạn đợt (#26): which deadline, from when to when, why, by whom, and whether it reopened submission. */
export interface DeadlineExtension {
  id: string;
  roundId: string;
  deadline: ExtendableDeadline;
  previousDeadline: Date;
  newDeadline: Date;
  reason: string;
  extendedBy: string;
  extendedAt: Date;
  /** True when it brought a Đã đóng nộp round back to Đang nhận nộp. */
  reopened: boolean;
}

export interface DeadlineExtensionView extends DeadlineExtension {
  extendedByName: string;
}

const VN_OFFSET_HOURS = 7;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A deadline entered as a calendar date in Vietnam means the end of that day:
 * 23:59:59 Asia/Ho_Chi_Minh (UTC+7, no daylight saving), stored in UTC.
 */
export function endOfVnDay(isoDate: string): Date {
  const m = ISO_DATE.exec(isoDate);
  const at = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23 - VN_OFFSET_HOURS, 59, 59)) : null;
  if (!at || at.toISOString().slice(0, 10) !== isoDate) throw new DomainError("invalid_date", `Ngày không hợp lệ: ${isoDate}`);
  return at;
}

/** The calendar date in Vietnam of an instant, as YYYY-MM-DD (to fill a date input from a stored deadline). */
export function vnDateOf(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** Hạn nộp xã ≤ Hạn gửi tỉnh ≤ Hạn đánh giá tỉnh; extensions (#26) keep this order too. */
export function assertDeadlineOrder(d: RoundDeadlines): void {
  if (d.submissionDeadline > d.forwardingDeadline || d.forwardingDeadline > d.evaluationDeadline) {
    throw new DomainError("deadline_order", "Các mốc hạn phải theo thứ tự: Hạn nộp xã ≤ Hạn gửi tỉnh ≤ Hạn đánh giá tỉnh");
  }
}

/** Only a Nháp round may be edited or deleted. */
export function assertDraftRound(round: Round): void {
  if (round.status !== "draft") throw new DomainError("round_not_draft", "Đợt đánh giá đã mở, không sửa hoặc xóa trực tiếp được");
}

/** Another round is Đang nhận nộp; the repo also raises it when the one-open index refuses a write. */
export const roundAlreadyOpen = (name?: string) =>
  new DomainError(
    "round_already_open",
    name ? `Đợt "${name}" đang nhận nộp; mỗi lúc chỉ có một đợt nhận nộp` : "Đang có đợt khác nhận nộp; mỗi lúc chỉ có một đợt nhận nộp",
  );

/** Past Hạn nộp xã: the instant is strictly after the deadline (the deadline second itself still counts). */
export const isPastSubmissionDeadline = (round: Pick<RoundDeadlines, "submissionDeadline">, now: Date) => now > round.submissionDeadline;
