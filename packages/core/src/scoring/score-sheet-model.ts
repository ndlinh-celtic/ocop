/**
 * Phiếu chấm (spec #49 "Phiếu chấm"; GLOSSARY.md): one thành viên chấm's grading of one hồ sơ, tied to their
 * Phân công of kind `member`. Giao chấm opens the first one, empty and `draft` (#53); its dòng chấm, xác
 * nhận, Vắng and Trả phiếu arrive with #54, #60 and #61. A confirmed phiếu is superseded, never reopened (ADR 0008).
 */
export const SCORE_SHEET_STATES = ["draft", "confirmed", "absent", "superseded"] as const;
export type ScoreSheetState = (typeof SCORE_SHEET_STATES)[number];

export interface ScoreSheet {
  id: string;
  dossierId: string;
  assignmentId: string;
  /** 1 for the first phiếu of a Phân công, then one more per Trả phiếu. */
  attempt: number;
  state: ScoreSheetState;
  confirmedAt: Date | null;
  reauthMethod: "totp" | "password" | null;
  supersededBy: string | null;
  supersededReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A dòng chấm: one Tiêu chí of a Phiếu chấm (#54). No row yet means the Tiêu chí is not scored. The sao chép from
 * Tổ tư vấn (L12) fills `source`, `advisoryVersionId` and `advisoryLevelOriginal`; `edited` marks a dòng the
 * thành viên has touched, which a later sao chép leaves as it is.
 */
export interface ScoreSheetLine {
  scoreSheetId: string;
  criterionId: string;
  scoreLevelId: string | null;
  comment: string;
  source: "member" | "advisory";
  advisoryVersionId: string | null;
  advisoryLevelOriginal: string | null;
  adjustReason: string | null;
  edited: boolean;
  updatedAt: Date;
  /** Bằng chứng kiểm tra. */
  fileIds: string[];
}

export interface ScoreSheetRepo {
  insert(s: ScoreSheet): Promise<void>;
  /** Writes a draft phiếu whose version is still `expectedVersion`; false when it changed meanwhile. */
  update(s: ScoreSheet, expectedVersion: number): Promise<boolean>;
  lines(scoreSheetId: string): Promise<ScoreSheetLine[]>;
  /** Inserts or replaces one dòng with its files (the database refuses it unless the phiếu is draft). */
  saveLine(line: ScoreSheetLine): Promise<void>;
  /**
   * Trả phiếu (ADR 0008): marks a confirmed or absent phiếu superseded by `supersededBy` (inserted later in the same
   * transaction), changing nothing else; false when it is no longer confirmed or absent.
   */
  supersede(id: string, supersededBy: string, reason: string): Promise<boolean>;
  /** Every phiếu of a hồ sơ already loaded within scope, superseded ones included, oldest first. */
  all(dossierId: string): Promise<ScoreSheet[]>;
  /** The phiếu not yet superseded of a hồ sơ already loaded within scope, one per Phân công at most. */
  current(dossierId: string): Promise<ScoreSheet[]>;
  /** Whether any hồ sơ of the đợt has a Phiếu chấm, whatever its state: from then on the đợt's grading config is fixed. */
  existsInRound(roundId: string): Promise<boolean>;
}
