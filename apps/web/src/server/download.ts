import "server-only";
import { DomainError } from "@ocop/core";
import { Readable } from "node:stream";

/** A plain-text reply, for a refused download or a bộ lọc that does not parse. */
export const textResponse = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** A refused rule of a download route: 403 forbidden, 404 not_found, 409 any other; anything else is a bug and propagates. */
export function domainErrorResponse(err: unknown): Response {
  if (!(err instanceof DomainError)) throw err;
  return textResponse(err.message, err.code === "forbidden" ? 403 : err.code === "not_found" ? 404 : 409);
}

/** A file to save, never cached: an ASCII `filename` for old clients beside the UTF-8 `filename*`. */
export function attachmentResponse(body: Uint8Array | AsyncIterable<Uint8Array>, file: { fileName: string; contentType: string; asciiName?: string }): Response {
  const ascii = (file.asciiName ?? file.fileName).replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new Response(body instanceof Uint8Array ? Buffer.from(body) : (Readable.toWeb(Readable.from(body)) as ReadableStream<Uint8Array>), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
