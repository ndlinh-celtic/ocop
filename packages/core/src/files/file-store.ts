/** A request the browser makes straight to object storage; the app never proxies file bytes. */
export interface PresignedRequest {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

/** One bucket of S3-compatible object storage (DC-03). */
export interface FileStore {
  presignPut(key: string, opts: { contentType: string; contentLength: number; expiresInSec: number }): Promise<PresignedRequest>;
  startMultipart(key: string, contentType: string): Promise<string>;
  presignPart(key: string, uploadId: string, partNumber: number, expiresInSec: number): Promise<PresignedRequest>;
  completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>;
  head(key: string): Promise<{ size: number; contentType: string | undefined } | null>;
  presignGet(key: string, opts: { fileName: string; expiresInSec: number }): Promise<PresignedRequest>;
  read(key: string): Promise<AsyncIterable<Uint8Array>>;
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  /**
   * Writes a body of unknown length from the server, in parts (multipart upload) so it is never held whole in
   * memory; returns the size written. A failure aborts the upload and leaves no object.
   */
  putStream(key: string, body: AsyncIterable<Uint8Array>, contentType: string): Promise<{ size: number }>;
  /** Removes an object; removing one that does not exist is not an error. */
  delete(key: string): Promise<void>;
}
