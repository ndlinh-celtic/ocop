import type { Tx } from "../shared/uow";

/**
 * What the rounds module needs to know about the work done inside a Đợt đánh giá (spec #16, #27), as
 * queries over other modules' tables run in the caller's transaction.
 */
export interface RoundActivity {
  /** Đợt đã có phiếu chấm: locks Chế độ chấm and Quy tắc tổng hợp from the first one on. */
  hasScoreSheets(tx: Tx, roundId: string): Promise<boolean>;
  /** Số hồ sơ chưa xong của đợt (no result yet): the round cannot end while it is above zero. */
  unfinishedDossierCount(tx: Tx, roundId: string): Promise<number>;
}

/**
 * Phiếu chấm do not exist until step 4 (L09-L15), so no đợt has one yet. Hồ sơ exist from step 3 (#44):
 * those submitted into the đợt and not yet in a finished state (dossiers' FINISHED_STATES) are counted.
 */
export const roundActivity: RoundActivity = {
  hasScoreSheets: async () => false,
  unfinishedDossierCount: (tx, roundId) => tx.dossiers.countUnfinishedInRound(roundId),
};
