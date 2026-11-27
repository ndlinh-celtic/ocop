import { describe, expect, it } from "vitest";
import { JOB_NAMES, JOBS } from "../src/registry";
import { mergeTables } from "../src/shared/tables";

describe("registry", () => {
  it("refuses two modules declaring the same key", () => {
    expect(() => mergeTables("job", [{ a: 1 }, { b: 2 }, { a: 3 }])).toThrow('Duplicate job "a"');
    expect(mergeTables("job", [{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 });
  });

  it("gives every recurring job a five-field cron and a queue name in its module's namespace", () => {
    expect(JOB_NAMES.length).toBeGreaterThan(0);
    for (const name of JOB_NAMES) {
      expect(name).toMatch(/^[a-z]+\.[a-z-]+$/);
      expect(JOBS[name].cron.split(" ")).toHaveLength(5);
    }
  });
});
