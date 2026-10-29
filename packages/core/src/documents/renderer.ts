/**
 * Văn bản the system generates from its own data (spec #30): a Word template filled with values the core
 * has already formatted for reading (dates in giờ Việt Nam, points with a decimal comma), so the template
 * holds layout only. Each template names the data it takes; a new văn bản (e.g. the Báo cáo đánh giá cấp
 * xã of #42) is a new key of DocumentTemplates plus its .docx in @ocop/infra.
 */

/** Phiếu đăng ký (L03, #37); the template number (Mẫu 01) is not yet checked against the văn bản căn cứ. */
export interface RegistrationFormData {
  wardName: string;
  roundName: string;
  entityName: string;
  entityKind: string;
  /** Mã số thuế, or the masked số định danh cá nhân of a hộ kinh doanh. */
  identifier: string;
  address: string;
  representativeName: string;
  phone: string;
  productName: string;
  criteriaSetCode: string;
  criteriaSetName: string;
  description: string;
  ingredients: string;
  process: string;
  packaging: string;
  qualityDeclaration: string;
  legalDocuments: { typeName: string; documentNumber: string; issuedOn: string }[];
  submissionNumber: string;
  submittedOn: string;
}

/** Báo cáo tự đánh giá (L03, #37): the tự chấm of every Tiêu chí with giải trình and minh chứng. */
export interface SelfAssessmentReportData {
  entityName: string;
  address: string;
  representativeName: string;
  productName: string;
  criteriaSetCode: string;
  criteriaSetName: string;
  legalBasis: string;
  roundName: string;
  criteria: { partCode: string; code: string; name: string; points: string; explanation: string; evidence: string }[];
  total: string;
  star: string;
  submissionNumber: string;
  submittedOn: string;
}

/**
 * Báo cáo đánh giá cấp xã (L06 XA-07, #42): the Checklist sơ bộ of the newest Phiên bản nộp, printed,
 * signed by the xã and uploaded back as a PDF. Thời gian, địa điểm, thành phần tham gia and ý kiến của
 * Chủ thể are left blank in the template for the xã to fill by hand. Nhận xét are not printed: the
 * signed report reaches the Chủ thể (story 35).
 */
export interface WardReportData {
  wardName: string;
  roundName: string;
  entityName: string;
  entityKind: string;
  identifier: string;
  address: string;
  representativeName: string;
  phone: string;
  productName: string;
  criteriaSetCode: string;
  criteriaSetName: string;
  submissionNumber: string;
  submittedOn: string;
  selfScoreTotal: string;
  selfScoreStar: string;
  checklist: { index: string; label: string; result: string }[];
  /** "Đủ điều kiện chuyển tỉnh" or "Chưa đủ điều kiện chuyển tỉnh". */
  suggestion: string;
  generatedOn: string;
}

/** One hồ sơ of a Phiên họp in a văn bản họp (L15 HD-09, #62); values formatted for reading. */
export interface MeetingDocumentRow {
  index: string;
  code: string;
  entityName: string;
  address: string;
  productName: string;
  /** "<mã> - <tên>" of the Bộ tiêu chí. */
  criteriaSet: string;
  /** Tổng điểm of each thành viên chấm, or "Vắng" / "Chưa xác nhận". */
  graders: { fullName: string; points: string }[];
  total: string;
  star: string;
  /** "Lệch điểm lớn (N điểm)" under a Cờ chênh lệch, else empty. */
  flag: string;
  unmet: string;
  absent: string;
  /** Nhận xét tổng hợp of the Báo cáo Tổ tư vấn (story 114). */
  advisorySummary: string;
  /** "Đã chốt" or "Tạm tính". */
  status: string;
  /** Dự thảo quyết định: mục (3) "Đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao" for a hồ sơ 5 sao (#83). */
  note: string;
  /** L16 (#80, story 8): the Nhận xét chung of the Chủ tịch or Thư ký, empty until written. */
  generalComment: string;
}

/**
 * The three văn bản họp of a Phiên họp (#62, stories 110 to 114): bảng tổng hợp điểm, dự thảo biên bản and dự thảo
 * quyết định công nhận share this data; the quyết định gets only the hồ sơ from 3 sao.
 */
export interface MeetingDocumentData {
  councilName: string;
  roundName: string;
  meetingTitle: string;
  heldOn: string;
  location: string;
  /** Whether the số liệu are final, or a bản nháp with hồ sơ not yet chốt. */
  status: string;
  count: string;
  dossiers: MeetingDocumentRow[];
  generatedOn: string;
}

/** One mục of the dự thảo Quyết định công nhận: 3 sao, 4 sao, or đạt điểm đề nghị Trung ương đánh giá 5 sao. */
export interface DecisionDraftSection {
  /** Số thứ tự of the mục among those printed. */
  index: string;
  heading: string;
  count: string;
  dossiers: MeetingDocumentRow[];
}

/**
 * The dự thảo Quyết định công nhận: theo Phiên họp (#62, #83), or bổ sung (#88, ADR 0009) with `supplementary` set, no
 * Phiên họp and only mục 4 sao. A template tells them apart with {#supplementary}…{/supplementary} and {^supplementary}.
 * `count` and `dossiers` are the hồ sơ công nhận (3 and 4 sao) only; `sections` adds the mục 5 sao, which công nhận nothing.
 */
export interface RecognitionDecisionData extends MeetingDocumentData {
  supplementary: boolean;
  sections: DecisionDraftSection[];
}

/** L16 HD-11 (#84, story 26): the bản nháp of a Giấy chứng nhận, đem đi ký số. */
export interface CertificateData {
  /** Số hiệu giấy chứng nhận, e.g. 012/2026/GCN-OCOP. */
  code: string;
  productName: string;
  entityName: string;
  address: string;
  /** Hạng công nhận, e.g. "4 sao". */
  star: string;
  issuedOn: string;
  expiresOn: string;
  decisionNumber: string;
  decisionSignedOn: string;
}

/** L16 HD-10 Thư kết quả không đạt (#85, spec #79 stories 36 to 43); values formatted for reading. */
export interface ResultLetterData {
  /** "1" for the letter, "2"… for a thư đính chính. */
  letterNumber: string;
  /** Empty for the first letter; for a thư đính chính, which letter it corrects and why. */
  correctionNote: string;
  dossierCode: string;
  entityName: string;
  address: string;
  representativeName: string;
  productName: string;
  criteriaSetCode: string;
  criteriaSetName: string;
  roundName: string;
  /** Điểm tổng hợp of the kết quả chốt. */
  total: string;
  /** Điểm theo Phần A, B, C. */
  parts: { code: string; total: string }[];
  /** "2 sao (không đạt)". */
  star: string;
  generalComment: string;
  /** Tiêu chí dưới mức, as the Sở settled them. */
  criteria: { index: string; code: string; name: string; average: string; maxPoints: string; reason: string }[];
  advice: string;
  issuedOn: string;
}

/** One hồ sơ of the Gói đề nghị 5 sao in its văn bản (L17 SO-04, #89); values formatted for reading. */
export interface FiveStarPackageDossierRow {
  index: string;
  code: string;
  productName: string;
  entityName: string;
  address: string;
  wardName: string;
  /** "<mã> - <tên>" of the Bộ tiêu chí. */
  criteriaSet: string;
  total: string;
  star: string;
  /** "Số <số>, ngày <dd/mm/yyyy>" of the Quyết định công nhận naming the hồ sơ. */
  decision: string;
}

/** Dự thảo văn bản đề nghị of the UBND tỉnh (#89, story 49): every hồ sơ of the package. */
export interface FiveStarProposalLetterData {
  count: string;
  dossiers: FiveStarPackageDossierRow[];
  generatedOn: string;
}

/** Mục lục of the Gói đề nghị 5 sao (#89, story 50): each file by folder, as named in the ZIP. */
export interface FiveStarPackageIndexData {
  count: string;
  /** The files at the root of the ZIP. */
  rootFiles: { name: string }[];
  dossiers: (Pick<FiveStarPackageDossierRow, "index" | "code" | "productName" | "entityName"> & {
    folder: string;
    files: { index: string; path: string }[];
  })[];
  generatedOn: string;
}

export interface DocumentTemplates {
  registration_form: RegistrationFormData;
  self_assessment_report: SelfAssessmentReportData;
  ward_report: WardReportData;
  meeting_score_table: MeetingDocumentData;
  meeting_minutes_draft: MeetingDocumentData;
  recognition_decision_draft: RecognitionDecisionData;
  certificate: CertificateData;
  result_letter: ResultLetterData;
  five_star_proposal_letter: FiveStarProposalLetterData;
  five_star_package_index: FiveStarPackageIndexData;
}

export type DocumentTemplate = keyof DocumentTemplates;

/**
 * A tag read from a template: a plain {name}, or a section {#name}…{/name} (also {^name}) with the tags inside it.
 * A section on a loop repeats per row; a section on any other variable shows its content when the value is not empty.
 */
export type TemplateTag = string | { name: string; children: readonly TemplateTag[] };

/** What reading a template's tags found: its tags, or why it cannot be a template (#82 story 75). */
export type TemplateInspection = { ok: true; tags: TemplateTag[] } | { ok: false; error: "not_docx" } | { ok: false; error: "syntax"; details: string[] };

/** Fills a Word template (docxtemplater in @ocop/infra) and returns the DOCX bytes. */
export interface DocumentRenderer {
  /**
   * Fills `source`, the bytes of a Mẫu văn bản uploaded as a phiên bản (#82), or else the mẫu mặc định shipped with
   * the app. Use cases go through renderDocument (templates.ts), which picks the mẫu đang dùng.
   */
  render<K extends DocumentTemplate>(template: K, data: DocumentTemplates[K], source?: Uint8Array): Promise<Uint8Array>;
  /** Reads the tags of a template without filling it. */
  inspect(source: Uint8Array): TemplateInspection;
  /** The mẫu mặc định of a loại, as shipped. */
  builtIn(template: DocumentTemplate): Uint8Array;
}

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
