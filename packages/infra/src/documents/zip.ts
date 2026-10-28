import archiver from "archiver";
import type { ArchiveSource, ZipWriter } from "@ocop/core";
import { Readable } from "node:stream";
import PizZip from "pizzip";

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

/** A ZIP of a few small generated files, built in memory (bản nháp giấy chứng nhận of one quyết định, #84). */
export function zipFiles(files: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const zip = new PizZip();
  for (const f of files) zip.file(f.name, f.bytes, { binary: true });
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}
