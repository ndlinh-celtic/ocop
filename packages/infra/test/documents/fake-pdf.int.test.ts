/** The PdfConverter stand-in other int tests get from createTestApp (#81). */
import { describe, expect, it } from "vitest";
import { FakePdfConverter } from "../support";

const text = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("FakePdfConverter", () => {
  it("returns a minimal valid PDF whose startxref points at the xref table", async () => {
    const pdf = text(await new FakePdfConverter().toPdf(new Uint8Array([1])));
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    const offset = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(offset, offset + 4)).toBe("xref");
    expect(pdf.slice(Number(/0000000(\d{3}) 00000 n/.exec(pdf)![1]))).toMatch(/^1 0 obj/);
  });

  it("counts calls, keeps the DOCX given, and fails on demand", async () => {
    const pdf = new FakePdfConverter();
    pdf.failNext(1);
    await expect(pdf.toPdf(new Uint8Array([1]))).rejects.toMatchObject({ code: "pdf_conversion_failed" });
    await pdf.toPdf(new Uint8Array([2]));
    expect(pdf.count).toBe(2);
    expect(pdf.calls.map((c) => c[0])).toEqual([1, 2]);
  });
});
