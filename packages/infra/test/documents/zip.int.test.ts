import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { zipFiles } from "../../src/documents/zip";

describe("zipFiles (#84)", () => {
  it("packs each file under its name, bytes unchanged", () => {
    const a = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 255, 1]);
    const b = new TextEncoder().encode("hai");
    const zip = new PizZip(
      zipFiles([
        { name: "Giay chung nhan 001-2026-GCN-OCOP.pdf", bytes: a },
        { name: "b.pdf", bytes: b },
      ]),
    );
    expect(Object.keys(zip.files).sort()).toEqual(["Giay chung nhan 001-2026-GCN-OCOP.pdf", "b.pdf"]);
    expect([...zip.file("Giay chung nhan 001-2026-GCN-OCOP.pdf")!.asUint8Array()]).toEqual([...a]);
    expect(zip.file("b.pdf")!.asText()).toBe("hai");
  });
});
