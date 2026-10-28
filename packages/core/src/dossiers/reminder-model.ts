/**
 * L03 CT-12 Nhắc hạn (stories 36 to 38, 55, 71). Three hạn are reminded at the Mốc nhắc hạn Quản trị sets:
 *   submission: Hạn nộp xã of the đợt Đang nhận nộp, to each Chủ thể with a Nháp on the đợt's Phiên bản tiêu chí;
 *   supplement: hạn bổ sung, to the Chủ thể of each hồ sơ Yêu cầu bổ sung;
 *   forwarding: Hạn gửi tỉnh of a đợt, to the Cán bộ xã of each xã that still holds hồ sơ of it not gửi tỉnh.
 * L16 (#86) adds a fourth, with one mốc in months rather than the Mốc nhắc hạn (results/certificate-expiry.ts):
 *   certificate_expiry: ngày hết hiệu lực of a Giấy chứng nhận, to its Chủ thể and the Cán bộ Sở.
 */
export const REMINDER_KINDS = ["submission", "supplement", "forwarding", "certificate_expiry"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Who a reminder goes to, and about what. */
export type ReminderTarget =
  | { kind: "submission"; roundId: string; entityId: string }
  | { kind: "supplement"; dossierId: string; entityId: string }
  | { kind: "forwarding"; roundId: string; wardId: string; pending: number };

/** What a dossier.reminder_due event carries; the consumers work out who hears it. */
export type ReminderPayload = ReminderTarget & { deadline: string; milestoneDays: number; daysLeft: number };

/** One reminder sent: the job's ledger key is everything but `sentAt`. */
export interface SentReminder {
  kind: ReminderKind;
  /** Who is reminded: the Chủ thể (submission, supplement, certificate_expiry) or the xã (forwarding). */
  subjectId: string;
  /** About what: the đợt (submission, forwarding), the hồ sơ (supplement) or the Giấy chứng nhận (certificate_expiry). */
  contextId: string;
  deadline: Date;
  milestoneDays: number;
  sentAt: Date;
}

/** System-wide reads for the job, which acts for no one's Phạm vi; they return ids, never hồ sơ. */
export interface ReminderRepo {
  /** The Chủ thể holding a Nháp (not deleted) on the Phiên bản tiêu chí. */
  entitiesWithDraft(criteriaVersionId: string): Promise<string[]>;
  /** Hồ sơ Yêu cầu bổ sung whose hạn bổ sung is not before `now`. */
  openSupplements(now: Date): Promise<{ dossierId: string; entityId: string; deadline: Date }[]>;
  /** Per xã, how many hồ sơ of the đợt are still Đã nộp xã or Yêu cầu bổ sung (not gửi tỉnh). */
  unforwardedByWard(roundId: string): Promise<{ wardId: string; count: number }[]>;
  /**
   * Giấy chứng nhận not yet expired on `today` (YYYY-MM-DD, giờ Việt Nam) and not yet reminded for their current ngày
   * hết hiệu lực, i.e. with no certificate_expiry row whose deadline is `expiryDeadline(expiresOn)`.
   */
  unremindedCertificates(today: string): Promise<{ certificateId: string; dossierId: string; entityId: string; expiresOn: string }[]>;
  /** Records a reminder; false, adding nothing, when it is already recorded. */
  record(r: SentReminder): Promise<boolean>;
}

/** The ledger deadline of a certificate_expiry reminder: the start, giờ Việt Nam, of the ngày hết hiệu lực. */
export const expiryDeadline = (expiresOn: string): Date => new Date(`${expiresOn}T00:00:00+07:00`);
