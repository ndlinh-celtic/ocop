import type { DecisionDraftSection, MeetingDocumentRow } from "../documents/renderer";

/*
 * Quyết định công nhận (L16 HD-11, #83, spec #79 "Quyết định công nhận", GLOSSARY.md, ADR 0009). The Chủ tịch UBND tỉnh
 * signs it outside the system; the Cán bộ Sở records the signed PDF with its số and ngày ký. A decision of a Phiên họp
 * names each hồ sơ from 3 sao of that Phiên họp in one mục; a Quyết định công nhận bổ sung (ADR 0009) has no Phiên họp.
 */

export const DECISION_KINDS = ["meeting", "supplementary"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

/** The mục of a quyết định a hồ sơ is named in; `five_star_proposal` approves the kết quả and recognizes nothing. */
export const DECISION_SECTIONS = ["three_star", "four_star", "five_star_proposal"] as const;
export type DecisionSection = (typeof DECISION_SECTIONS)[number];

export const DECISION_SECTION_LABEL: Record<DecisionSection, string> = {
  three_star: "Công nhận 3 sao",
  four_star: "Công nhận 4 sao",
  five_star_proposal: "Đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao",
};

/** The heading of each mục in the dự thảo quyết định (#79 review: mục 5 sao reads exactly as in the mẫu QĐ 26). */
const DECISION_DRAFT_HEADING: Record<DecisionSection, string> = {
  three_star: "Sản phẩm được công nhận đạt 3 sao",
  four_star: "Sản phẩm được công nhận đạt 4 sao",
  five_star_proposal: "Sản phẩm đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao",
};

/**
 * The mục of a dự thảo quyết định, in order 3 sao, 4 sao, 5 sao, each with its rows numbered from 1; a mục without hồ
 * sơ is left out and the others numbered in turn. Only mục 3 and 4 sao are công nhận: `recognized` is what Điều 1 counts.
 */
export function decisionDraftSections(rows: readonly { section: DecisionSection; row: MeetingDocumentRow }[]): {
  sections: DecisionDraftSection[];
  recognized: MeetingDocumentRow[];
} {
  const sections: DecisionDraftSection[] = [];
  for (const section of DECISION_SECTIONS) {
    const dossiers = rows.filter((r) => r.section === section).map(({ row }, i) => ({ ...row, index: String(i + 1) }));
    if (dossiers.length === 0) continue;
    sections.push({ index: String(sections.length + 1), heading: DECISION_DRAFT_HEADING[section], count: String(dossiers.length), dossiers });
  }
  const recognized = rows.filter((r) => r.section !== "five_star_proposal").map(({ row }, i) => ({ ...row, index: String(i + 1) }));
  return { sections, recognized };
}

/** The mục of a hồ sơ from its Hạng sao (of the kết quả chốt hiện hành); null below 3 sao, which no decision names. */
export function sectionOf(star: number): DecisionSection | null {
  if (star >= 5) return "five_star_proposal";
  if (star === 4) return "four_star";
  if (star === 3) return "three_star";
  return null;
}

/**
 * Hạng công nhận (GLOSSARY.md, ADR 0009): the Hạng sao the tỉnh công nhận, printed on the Giấy chứng nhận. It is the Hạng
 * sao of the kết quả chốt from 3 to 4 sao; a hồ sơ 5 sao is công nhận 4 sao only once the Bộ trả về; below 3 sao, or 5
 * sao still đề nghị Trung ương, the tỉnh công nhận nothing. The kết quả chốt is never changed.
 */
export function recognizedStar(result: { star: number }, returnedFromMinistry: boolean): 3 | 4 | null {
  if (result.star === 3 || result.star === 4) return result.star;
  if (result.star >= 5 && returnedFromMinistry) return 4;
  return null;
}

export interface RecognitionDecision {
  id: string;
  kind: DecisionKind;
  /** The Phiên họp of a `meeting` decision; null for a Quyết định công nhận bổ sung. */
  meetingId: string | null;
  number: string;
  /** Ngày ký, a calendar date (YYYY-MM-DD). */
  signedOn: string;
  fileId: string;
  recordedBy: string;
  recordedAt: Date;
}

export interface RecognitionDecisionDossier {
  decisionId: string;
  dossierId: string;
  section: DecisionSection;
}

export interface RecognitionDecisionRepo {
  /** False when the Phiên họp already has its decision (the DB keeps one per Phiên họp). */
  insert(d: RecognitionDecision, dossiers: readonly RecognitionDecisionDossier[]): Promise<boolean>;
  findById(id: string): Promise<RecognitionDecision | null>;
  /** The decision of a Phiên họp, if recorded. */
  ofMeeting(meetingId: string): Promise<RecognitionDecision | null>;
  /** The hồ sơ a decision names. */
  dossiers(decisionId: string): Promise<RecognitionDecisionDossier[]>;
  /** The decisions naming a hồ sơ, oldest first, with its mục in each. */
  ofDossier(dossierId: string): Promise<(RecognitionDecision & { section: DecisionSection })[]>;
  /** The decisions of a kind, newest recorded first (#88: the Quyết định công nhận bổ sung). */
  ofKind(kind: DecisionKind): Promise<RecognitionDecision[]>;
  /** SELECT … FOR UPDATE (#84). */
  lock(id: string): Promise<RecognitionDecision | null>;
  /** Story 17 (#84): corrects the số and ngày ký, the only columns the DB lets change. */
  amend(id: string, fields: { number: string; signedOn: string }): Promise<void>;
}
