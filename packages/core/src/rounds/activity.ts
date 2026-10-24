import type { Tx } from "../shared/uow";

/**
 * What the rounds module needs to know about the work done inside a Đợt đánh giá (spec #16, #27), as
 * queries over other modules' tables run in the caller's transaction.
 */
export interface RoundActivity {
  /** Đợt đã có phiếu chấm: locks Chế độ chấm, Quy tắc tổng hợp and the Hội đồng from the first one on. */
  hasScoreSheets(tx: Tx, roundId: string): Promise<boolean>;
  /** Số hồ sơ chưa xong của đợt (no result yet): the round cannot end while it is above zero. */
  unfinishedDossierCount(tx: Tx, roundId: string): Promise<number>;
}

/**
 * The first Phiếu chấm of a đợt comes with its first Giao chấm (L09 HD-06, #53). Hồ sơ chưa xong are those
 * submitted into the đợt and not yet in a finished state (dossiers' FINISHED_STATES, #44).
 */
export const roundActivity: RoundActivity = {
  hasScoreSheets: (tx, roundId) => tx.scoreSheets.existsInRound(roundId),
  unfinishedDossierCount: (tx, roundId) => tx.dossiers.countUnfinishedInRound(roundId),
};
