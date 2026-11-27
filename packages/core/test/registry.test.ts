import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSUMER_NAMES, JOB_NAMES, JOBS, MODULES, QUEUE_NAMES } from "../src/registry";
import { mergeTables } from "../src/shared/tables";

const SRC = join(import.meta.dirname, "../src");
const UNION_FILES = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "shared")
  .filter((d) => readdirSync(join(SRC, d.name)).includes("module.ts"))
  .map((d) => `${d.name}/module.ts`);

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

  it("lists every module directory that has a module.ts", () => {
    const dirs = readdirSync(SRC, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && d.name !== "shared" && readdirSync(join(SRC, d.name)).includes("module.ts"),
    );
    expect(dirs.map((d) => d.name).sort()).toEqual(Object.keys(MODULES).sort());
    expect(CONSUMER_NAMES.length).toBeGreaterThan(0);
  });

  it("gives consumers and jobs distinct queue names", () => {
    expect(QUEUE_NAMES).toHaveLength(CONSUMER_NAMES.length + JOB_NAMES.length);
  });

  // .gitattributes merges module.ts with merge=union, which is only correct when an entry is one line: two branches
  // appending multi-line entries at one place share their closing lines, and union keeps one copy (the #95 missing `},`).
  // An entry too long for one line points at a constant or function in its feature file (as NOTICE_EVENTS does).
  it.each(UNION_FILES)("keeps one line per entry in %s", (file) => {
    const deep = readFileSync(join(SRC, file), "utf8")
      .split("\n")
      .filter((line) => !line.startsWith("import") && !/^\s*(\/\/|\*|\/\*)/.test(line))
      .filter((line) => /^\s+/.test(line) && line.search(/\S/) > 4);
    expect(deep).toEqual([]);
  });
});
