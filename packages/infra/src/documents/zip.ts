import archiver from "archiver";
import type { ArchiveSource, ZipWriter } from "@ocop/core";
import { Readable } from "node:stream";

/** Opens the stored object only when archiver reaches the entry, so one download runs at a time. */
async function* opened(open: ArchiveSource): AsyncIterable<Uint8Array> {
  yield* await open();
}

/** The ZipWriter of @ocop/core with archiver (#89): entries are compressed one after another as the stream is read. */
export function archiverZipWriter(): ZipWriter {
  return {
    zip(entries) {
      const archive = archiver("zip", { zlib: { level: 6 } });
      for (const e of entries) {
        archive.append(e.content instanceof Uint8Array ? Buffer.from(e.content) : Readable.from(opened(e.content)), { name: e.path });
      }
      // Errors of finalize also reach the stream's readers, which is where they are handled.
      archive.finalize().catch(() => undefined);
      return archive;
    },
  };
}
