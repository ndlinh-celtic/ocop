import PizZip from "pizzip";

/** A ZIP of a few small generated files, built in memory (bản nháp giấy chứng nhận of one quyết định, #84). */
export function zipFiles(files: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const zip = new PizZip();
  for (const f of files) zip.file(f.name, f.bytes, { binary: true });
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}
