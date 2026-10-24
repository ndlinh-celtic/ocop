/**
 * Hội đồng (L09 HD-01, spec #49): the Hội đồng đánh giá, phân hạng cấp tỉnh, recorded by Cán bộ Sở from
 * its quyết định thành lập. Its members are not stored here: they are the Phân vai in force on Phạm vi
 * Hội đồng (identity). One Hội đồng may serve several Đợt đánh giá (round.councilId).
 */
export interface Council {
  id: string;
  name: string;
  /** Số quyết định thành lập. */
  decisionNumber: string;
  /** Ngày quyết định thành lập, a calendar date (YYYY-MM-DD). */
  decisionDate: string;
  /** The uploaded quyết định thành lập (files, purpose `council_decision`). */
  decisionFileId: string;
  /** Tổ trưởng: a Thành viên Tổ tư vấn of this Hội đồng, the only one who issues a Báo cáo Tổ tư vấn. */
  leaderUserId: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface CouncilRepo {
  insert(council: Council): Promise<void>;
  update(council: Council): Promise<void>;
  findById(id: string): Promise<Council | null>;
  /** Like findById, but holds a row lock until the transaction ends (SELECT … FOR UPDATE). */
  lock(id: string): Promise<Council | null>;
  /** Newest first. */
  list(): Promise<Council[]>;
}
