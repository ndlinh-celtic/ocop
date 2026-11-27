// The public interface of the documents module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export {
  DOCX_TYPE,
  type DocumentRenderer,
  type DocumentTemplate,
  type DocumentTemplates,
  type RegistrationFormData,
  type SelfAssessmentReportData,
  type WardReportData,
  type MeetingDocumentData,
  type ResultLetterData,
  type RecognitionDecisionData,
  type DecisionDraftSection,
  type FiveStarPackageDossierRow,
  type FiveStarPackageIndexData,
  type FiveStarProposalLetterData,
  type MeetingDocumentRow,
  type TemplateInspection,
  type TemplateTag,
} from "./renderer";
export {
  checkTemplateTags,
  isTemplateKind,
  TEMPLATE_KINDS,
  TEMPLATE_LABEL,
  TEMPLATE_SAMPLES,
  TEMPLATE_VARIABLES,
  type TemplateProblem,
  type TemplateVariable,
} from "./template-variables";
export { renderDocument, type RenderedDocument, type TemplateKindView, type TemplateVersionView } from "./templates";
export type { TemplateVersion, TemplateVersionRepo } from "./template-version-model";
export { PDF_TYPE, PdfConversionError, type PdfConverter } from "./pdf";
export { XLSX_TYPE, type SpreadsheetCell, type SpreadsheetColumn, type SpreadsheetSheet, type SpreadsheetWriter } from "./spreadsheet";
export { ZIP_TYPE, type ArchiveEntry, type ArchiveSource, type ZipWriter } from "./archive";
