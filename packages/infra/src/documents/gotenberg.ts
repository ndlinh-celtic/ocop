import { DOCX_TYPE, PdfConversionError, type PdfConverter } from "@ocop/core";

export interface GotenbergSettings {
  /** Base URL inside the deployment, e.g. http://gotenberg:3000. */
  url: string;
  /** Whole request, connect to last byte; Gotenberg's own --api-timeout should be a little shorter. */
  timeoutMs?: number;
  /** Largest DOCX sent; Gotenberg's --api-body-limit matches it. */
  maxBytes?: number;
}

export const GOTENBERG_DEFAULTS = { timeoutMs: 60_000, maxBytes: 20 * 1024 * 1024 } as const;

/**
 * PdfConverter over Gotenberg's LibreOffice route (POST /forms/libreoffice/convert). Every failure (nothing
 * listening, timeout, non-2xx, a body that is not a PDF) becomes a PdfConversionError, never a hang.
 */
export function gotenbergPdfConverter(settings: GotenbergSettings): PdfConverter {
  const timeoutMs = settings.timeoutMs ?? GOTENBERG_DEFAULTS.timeoutMs;
  const maxBytes = settings.maxBytes ?? GOTENBERG_DEFAULTS.maxBytes;
  const endpoint = new URL("/forms/libreoffice/convert", settings.url).toString();
  return {
    async toPdf(docx) {
      if (docx.byteLength > maxBytes) throw new PdfConversionError(`DOCX of ${docx.byteLength} bytes exceeds the ${maxBytes}-byte limit`);
      const form = new FormData();
      form.append("files", new Blob([docx], { type: DOCX_TYPE }), "document.docx");
      let res: Response;
      let body: Uint8Array;
      try {
        res = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
        body = new Uint8Array(await res.arrayBuffer());
      } catch (err) {
        const e = err as Error & { cause?: { code?: string } };
        const reason = e.name === "TimeoutError" ? `no answer within ${timeoutMs} ms` : (e.cause?.code ?? e.message);
        throw new PdfConversionError(`Gotenberg at ${settings.url}: ${reason}`);
      }
      if (!res.ok) {
        const text = Buffer.from(body.subarray(0, 300)).toString("utf8");
        throw new PdfConversionError(`Gotenberg answered ${res.status}: ${text}`);
      }
      if (Buffer.from(body.subarray(0, 5)).toString("latin1") !== "%PDF-") throw new PdfConversionError("Gotenberg answered with something that is not a PDF");
      return body;
    },
  };
}
