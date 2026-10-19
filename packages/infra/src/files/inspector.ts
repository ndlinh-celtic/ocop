import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import type { FileInspector, FileStore } from "@ocop/core";
import { fileTypeFromBuffer } from "file-type";
import type { VirusScanner } from "./clamd";

const SNIFF_BYTES = 64 * 1024;

/** Reads the object once: the bytes feed the hash, the magic-byte sniffer and the virus scanner together. */
export function createFileInspector(store: FileStore, scanner: VirusScanner): FileInspector {
  return {
    async inspect(storageKey) {
      const source = await store.read(storageKey);
      const hash = createHash("sha256");
      const head: Buffer[] = [];
      let headLength = 0;
      const toScanner = new PassThrough();
      const verdict = scanner.scan(toScanner);
      try {
        for await (const chunk of source) {
          const buf = Buffer.from(chunk);
          hash.update(buf);
          if (headLength < SNIFF_BYTES) {
            head.push(buf);
            headLength += buf.length;
          }
          if (!toScanner.write(buf)) await new Promise((r) => toScanner.once("drain", r));
        }
        toScanner.end();
      } catch (err) {
        toScanner.destroy(err as Error);
        throw err;
      }
      const result = await verdict;
      const type = await fileTypeFromBuffer(Buffer.concat(head).subarray(0, SNIFF_BYTES));
      return { sha256: hash.digest("hex"), detectedType: type?.mime ?? null, virus: result.clean ? null : result.signature };
    },
  };
}
