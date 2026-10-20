import type { Tx } from "../shared/uow";

/**
 * What the rounds module needs to know about the work done inside a Đợt đánh giá (spec #16, #27).
 * Phiếu chấm and hồ sơ do not exist yet: step 3 (L01-L06) and step 4 (L09-L15) replace the placeholder
 * with queries over their own tables, run in the caller's transaction.
 */
export interface RoundActivity {
  /** Đợt đã có phiếu chấm: locks Chế độ chấm and Quy tắc tổng hợp from the first one on. */
  hasScoreSheets(tx: Tx, roundId: string): Promise<boolean>;
  /** Số hồ sơ chưa xong của đợt (no result yet): the round cannot end while it is above zero. */
  unfinishedDossierCount(tx: Tx, roundId: string): Promise<number>;
}

/** Placeholder until phiếu chấm and hồ sơ exist: no score sheet, nothing unfinished. */
export const placeholderRoundActivity: RoundActivity = {
  hasScoreSheets: async () => false,
  unfinishedDossierCount: async () => 0,
};
