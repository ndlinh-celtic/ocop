import { describe, expect, it } from "vitest";
import { uniqueNames, zipSafeName } from "../src/results/zip-names";

/* Names in the Gói đề nghị 5 sao (#89, spec #79): without dấu, safe for Windows where the Bộ opens the ZIP. */
describe("zipSafeName", () => {
  it.each([
    ["Bưởi da xanh An Phú", "Buoi da xanh An Phu"],
    ["Đặc sản Đồng Tháp.pdf", "Dac san Dong Thap.pdf"],
    ["Ảnh sản phẩm.PDF", "Anh san pham.PDF"],
    ['Mắm: tôm/cá?*<>|"\\.pdf', "Mam_ tom_ca_______.pdf"],
    ["Tên\ttệp\n  nhiều   khoảng.pdf", "Ten tep nhieu khoang.pdf"],
    ["Biên bản. . ", "Bien ban"],
    ["CON.pdf", "_CON.pdf"],
    ["nul", "_nul"],
    ["Com1.tar.gz", "_Com1.tar.gz"],
    ["CONSOLE.pdf", "CONSOLE.pdf"],
    ["😀", "_"],
    ["", "_"],
  ])("%j → %j", (name, safe) => {
    expect(zipSafeName(name)).toBe(safe);
  });

  it("shortens a long name to 80 characters, keeping its extension", () => {
    const safe = zipSafeName(`${"Hợp đồng thu mua nguyên liệu ".repeat(10)}.pdf`);
    expect(safe).toHaveLength(80);
    expect(safe.endsWith("u.pdf") || safe.endsWith(".pdf")).toBe(true);
    expect(safe).not.toMatch(/[ .]\.pdf$/);
  });
});

describe("uniqueNames", () => {
  it("numbers a name repeated in one folder, ignoring case as Windows does", () => {
    const unique = uniqueNames();
    expect(["a.pdf", "A.pdf", "a.pdf", "b"].map(unique)).toEqual(["a.pdf", "A (2).pdf", "a (3).pdf", "b"]);
  });
});
