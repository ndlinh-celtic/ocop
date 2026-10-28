/*
 * Giấy chứng nhận (L16 HD-11, #84, spec #79 "Giấy chứng nhận và số hiệu", GLOSSARY.md, ADR 0009). Each hồ sơ a Quyết
 * định công nhận recognizes gets exactly one, numbered when the quyết định is recorded: số thứ tự/năm/đuôi, the số thứ
 * tự restarting at 1 each year (the year of the ngày ký). Its ngày cấp is the ngày ký of the quyết định, its ngày hết
 * hiệu lực a configured number of months later. It is Chờ ký until the Cán bộ Sở uploads the signed PDF.
 */

export const CERTIFICATE_STATES = ["awaiting_signature", "signed"] as const;
export type CertificateState = (typeof CERTIFICATE_STATES)[number];

export const CERTIFICATE_STATE_LABEL: Record<CertificateState, string> = {
  awaiting_signature: "Chờ ký",
  signed: "Đã ký",
};

/** Story 23: the đuôi of a số hiệu until Quản trị changes it. */
export const DEFAULT_CERTIFICATE_CODE_SUFFIX = "GCN-OCOP";
/** Story 31: months from the ngày cấp to the ngày hết hiệu lực (QĐ 26/2026, *cần kiểm tra*). */
export const DEFAULT_CERTIFICATE_VALIDITY_MONTHS = 36;
/** Story 32: months before the ngày hết hiệu lực the Sở and the Chủ thể are reminded once. */
export const DEFAULT_CERTIFICATE_EXPIRY_REMINDER_MONTHS = 6;

export interface Certificate {
  id: string;
  dossierId: string;
  decisionId: string;
  year: number;
  seq: number;
  /** The Số hiệu giấy chứng nhận as printed, e.g. 012/2026/GCN-OCOP; never changes once issued. */
  code: string;
  /** Hạng công nhận (3 or 4), which is not always the Hạng sao of the kết quả chốt (ADR 0009). */
  recognizedStar: number;
  /** Ngày cấp, the ngày ký of the quyết định (YYYY-MM-DD). */
  issuedOn: string;
  /** Ngày hết hiệu lực (YYYY-MM-DD). */
  expiresOn: string;
  state: CertificateState;
  /** The bản nháp PDF; null while it is being generated ("đang tạo"). */
  draftFileId: string | null;
  /** The phiên bản mẫu the bản nháp was filled from; null for the mẫu mặc định. */
  templateVersionId: string | null;
  issuedAt: Date;
}

/** One upload of the signed PDF; the newest is the bản hiện hành, older ones are kept (story 29). */
export interface CertificateSignedFile {
  certificateId: string;
  n: number;
  fileId: string;
  /** Required from the second upload on. */
  reason: string | null;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface CertificateFilter {
  year?: number;
  state?: CertificateState;
  decisionId?: string;
}

export interface CertificateRepo {
  /** The next số thứ tự of a year, from the cert_counter row of that year, in the caller's transaction. */
  nextSeq(year: number): Promise<number>;
  insert(c: Certificate): Promise<void>;
  findById(id: string): Promise<Certificate | null>;
  /** SELECT … FOR UPDATE. */
  lock(id: string): Promise<Certificate | null>;
  ofDossier(dossierId: string): Promise<Certificate | null>;
  /** By số thứ tự. */
  ofDecision(decisionId: string): Promise<Certificate[]>;
  /** Newest year first, then by số thứ tự. */
  list(filter: CertificateFilter): Promise<Certificate[]>;
  /** Writes the fields that may change: ngày cấp, ngày hết hiệu lực, state, bản nháp and its phiên bản mẫu. */
  update(c: Certificate): Promise<void>;
  /** Oldest first. */
  signedFiles(certificateId: string): Promise<CertificateSignedFile[]>;
  addSignedFile(f: CertificateSignedFile): Promise<void>;
}

/** Story 23: số thứ tự of at least three digits/năm/đuôi, e.g. 012/2026/GCN-OCOP. */
export function formatCertificateCode(seq: number, year: number, suffix: string): string {
  return `${String(seq).padStart(3, "0")}/${year}/${suffix}`;
}

/** Story 31: `issuedOn` plus `months` calendar months; a day the target month lacks becomes its last day. */
export function certificateExpiry(issuedOn: string, months: number): string {
  const [y, m, d] = issuedOn.split("-").map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Story 24: the order the hồ sơ of one quyết định are numbered in: Hạng công nhận descending, then mã hồ sơ. */
export function orderForNumbering<T extends { code: string; recognizedStar: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.recognizedStar - a.recognizedStar || a.code.localeCompare(b.code));
}
