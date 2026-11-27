/*
 * Builds the ZIP of the Gói đề nghị 5 sao (L17 SO-04, #89): archiver in @ocop/infra. The archive is produced as a
 * stream, so a package holding the minh chứng of many hồ sơ never sits whole in memory; the use case pipes it to
 * object storage (FileStore.putStream).
 */

/** Opens one stored object to copy into the archive; called only when the archive reaches that entry. */
export type ArchiveSource = () => Promise<AsyncIterable<Uint8Array>>;

export interface ArchiveEntry {
  /** Path inside the archive, "/" between folders; already safe for Windows (see zipSafeName). */
  path: string;
  content: Uint8Array | ArchiveSource;
}

export interface ZipWriter {
  /** The ZIP of `entries`, in order, as a stream of bytes; an entry that fails to open fails the stream. */
  zip(entries: readonly ArchiveEntry[]): AsyncIterable<Uint8Array>;
}

export const ZIP_TYPE = "application/zip";
