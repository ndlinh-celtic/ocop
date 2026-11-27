import { describe, expect, it } from "vitest";
import { endOfVnDay, vnDateOf, vnTimeOf } from "../src/rounds/model";

describe("L07 SO-01 a deadline date means the end of that day in Vietnam", () => {
  it.each([
    ["2026-06-30", "2026-06-30T16:59:59.000Z"],
    ["2026-12-31", "2026-12-31T16:59:59.000Z"],
    ["2028-02-29", "2028-02-29T16:59:59.000Z"],
  ])("%s → %s", (day, utc) => {
    expect(endOfVnDay(day).toISOString()).toBe(utc);
  });

  it.each(["2026-02-30", "2026-13-01", "30/06/2026", ""])("refuses %j", (day) => {
    expect(() => endOfVnDay(day)).toThrow(expect.objectContaining({ code: "invalid_date" }));
  });

  it.each([
    ["2026-06-30T16:59:59Z", "2026-06-30"],
    ["2026-06-30T17:00:00Z", "2026-07-01"],
    ["2026-06-29T17:00:00Z", "2026-06-30"],
  ])("the Vietnam calendar date of %s is %s", (at, day) => {
    expect(vnDateOf(new Date(at))).toBe(day);
  });
});

describe("vnTimeOf", () => {
  it("is the time of day in Vietnam, HH:mm, crossing midnight like vnDateOf", () => {
    expect(vnTimeOf(new Date("2026-10-28T02:05:00Z"))).toBe("09:05");
    expect(vnTimeOf(new Date("2026-10-28T17:30:59Z"))).toBe("00:30");
  });
});
