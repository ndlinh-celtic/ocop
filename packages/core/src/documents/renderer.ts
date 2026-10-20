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

export interface DocumentTemplates {
  registration_form: RegistrationFormData;
  self_assessment_report: SelfAssessmentReportData;
  ward_report: WardReportData;
}

export type DocumentTemplate = keyof DocumentTemplates;

/** Fills a Word template (docxtemplater in @ocop/infra) and returns the DOCX bytes. */
export interface DocumentRenderer {
  render<K extends DocumentTemplate>(template: K, data: DocumentTemplates[K]): Promise<Uint8Array>;
}

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
