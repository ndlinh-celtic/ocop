import { describe, expect, it } from "vitest";
import { expiryReminderDay } from "../src/results/certificate-expiry";
import { certificateExpiry, formatCertificateCode, orderForNumbering, validityMonthsOf } from "../src/results/certificate-model";

/*
 * L16 HD-11 (#84, spec #79 stories 23, 24, 31, GLOSSARY "Số hiệu giấy chứng nhận"): the số hiệu of a Giấy chứng nhận,
 * its ngày hết hiệu lực, and the order the hồ sơ of one quyết định are numbered in.
 */

describe("formatCertificateCode", () => {
  it("pads the số thứ tự to three digits", () => {
    expect(formatCertificateCode(12, 2026, "GCN-OCOP")).toBe("012/2026/GCN-OCOP");
    expect(formatCertificateCode(1, 2027, "GCN-OCOP")).toBe("001/2027/GCN-OCOP");
  });

  it("keeps every digit past 999", () => {
    expect(formatCertificateCode(999, 2026, "GCN-OCOP")).toBe("999/2026/GCN-OCOP");
    expect(formatCertificateCode(1000, 2026, "GCN-OCOP")).toBe("1000/2026/GCN-OCOP");
  });

  it("uses the configured đuôi", () => {
    expect(formatCertificateCode(7, 2026, "GCN-OCOP-QN")).toBe("007/2026/GCN-OCOP-QN");
  });
});

describe("certificateExpiry", () => {
  it("adds calendar months", () => {
    expect(certificateExpiry("2026-10-19", 36)).toBe("2029-10-19");
  });

  it("moves to the last day of the month when the day does not exist", () => {
    expect(certificateExpiry("2026-01-31", 1)).toBe("2026-02-28");
    expect(certificateExpiry("2026-03-31", 1)).toBe("2026-04-30");
    expect(certificateExpiry("2027-01-31", 13)).toBe("2028-02-29");
  });

  it("handles 29/2", () => {
    expect(certificateExpiry("2028-02-29", 36)).toBe("2031-02-28");
    expect(certificateExpiry("2028-02-29", 48)).toBe("2032-02-29");
  });

  it("crosses into the next year", () => {
    expect(certificateExpiry("2026-11-15", 3)).toBe("2027-02-15");
    expect(certificateExpiry("2026-12-31", 2)).toBe("2027-02-28");
  });
});

describe("orderForNumbering", () => {
  it("numbers Hạng công nhận 4 before 3, then by mã hồ sơ", () => {
    const rows = [
      { code: "OCOP-2026-0003", recognizedStar: 3 },
      { code: "OCOP-2026-0004", recognizedStar: 4 },
      { code: "OCOP-2026-0001", recognizedStar: 3 },
      { code: "OCOP-2026-0002", recognizedStar: 4 },
    ];
    expect(orderForNumbering(rows).map((r) => r.code)).toEqual(["OCOP-2026-0002", "OCOP-2026-0004", "OCOP-2026-0001", "OCOP-2026-0003"]);
    // The input is not reordered.
    expect(rows[0]!.code).toBe("OCOP-2026-0003");
  });
});

describe("expiryReminderDay (#86)", () => {
  it("is the same day of the month the given months earlier", () => {
    expect(expiryReminderDay("2029-10-12", 6)).toBe("2029-04-12");
    expect(expiryReminderDay("2029-03-15", 6)).toBe("2028-09-15");
  });

  it("falls on the last day of a shorter month", () => {
    expect(expiryReminderDay("2029-08-31", 6)).toBe("2029-02-28");
    expect(expiryReminderDay("2028-08-31", 6)).toBe("2028-02-29");
  });
});

describe("validityMonthsOf", () => {
  it("gives back the months a giấy was issued for, also when the ngày hết hiệu lực was clamped to the end of a month", () => {
    expect(validityMonthsOf("2026-10-19", "2029-10-19")).toBe(36);
    expect(validityMonthsOf("2026-01-31", "2026-02-28")).toBe(1);
    expect(validityMonthsOf("2028-02-29", "2031-02-28")).toBe(36);
    expect(validityMonthsOf("2027-01-31", "2028-02-29")).toBe(13);
  });
});
