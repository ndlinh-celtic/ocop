import type { DocumentTemplate } from "@ocop/core";

/**
 * The Word file of each template, in `packages/infra/templates/`. Edit them in Word, keeping the {tags},
 * then run `pnpm --filter @ocop/infra templates:embed`: the app reads the embedded copy so that the Next
 * standalone build and the worker need no template files at runtime. A test fails while the two differ.
 */
export const TEMPLATE_FILES: Record<DocumentTemplate, string> = {
  registration_form: "phieu-dang-ky.docx",
  self_assessment_report: "bao-cao-tu-danh-gia.docx",
  ward_report: "bao-cao-danh-gia-cap-xa.docx",
};
