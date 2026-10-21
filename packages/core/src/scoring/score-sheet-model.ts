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

export interface ScoreSheetRepo {
  insert(s: ScoreSheet): Promise<void>;
  /** The phiếu not yet superseded of a hồ sơ already loaded within scope, one per Phân công at most. */
  current(dossierId: string): Promise<ScoreSheet[]>;
  /** Whether any hồ sơ of the đợt has a Phiếu chấm, whatever its state: from then on the đợt's grading config is fixed. */
  existsInRound(roundId: string): Promise<boolean>;
}
