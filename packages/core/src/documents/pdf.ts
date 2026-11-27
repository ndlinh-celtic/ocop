import { DomainError } from "../shared/errors";

/**
 * Turns a DOCX filled from a Mẫu văn bản into PDF (giấy chứng nhận, thư kết quả, mục lục gói 5 sao; #81).
 * Gotenberg inside the deployment in @ocop/infra; never a service outside the country.
 */
export interface PdfConverter {
  toPdf(docx: Uint8Array): Promise<Uint8Array>;
}

export const PDF_TYPE = "application/pdf";

/**
 * The converter could not produce a PDF (unreachable, timed out, 5xx, too large). A DomainError so the UI shows
 * a message rather than failing the request; an outbox consumer throwing it is retried. `detail` keeps the
 * technical cause for logs.
 */
export class PdfConversionError extends DomainError {
  static override readonly brand = "PdfConversionError";

  constructor(readonly detail: string) {
    super("pdf_conversion_failed", "Chưa chuyển được văn bản sang PDF, vui lòng thử lại sau");
    this.name = "PdfConversionError";
  }
}
