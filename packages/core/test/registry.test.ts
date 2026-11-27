import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSUMER_NAMES, JOB_NAMES, JOBS, MODULES } from "../src/registry";
import { mergeTables } from "../src/shared/tables";

const SRC = join(import.meta.dirname, "../src");
const UNION_FILES = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "shared")
  .flatMap((d) => ["module.ts", "permissions.ts"].filter((f) => readdirSync(join(SRC, d.name)).includes(f)).map((f) => `${d.name}/${f}`));

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

  // .gitattributes merges these files with merge=union, which is only correct when an entry is one line: two branches
  // appending multi-line entries at one place share their closing lines, and union keeps one copy (the #95 missing `},`).
  it.each(UNION_FILES)("keeps one line per entry in %s", (file) => {
    const deep = readFileSync(join(SRC, file), "utf8")
      .split("\n")
      .filter((line) => !line.startsWith("import") && !/^\s*(\/\/|\*|\/\*)/.test(line))
      .filter((line) => /^\s+/.test(line) && line.search(/\S/) > (file.endsWith("permissions.ts") ? 2 : 4));
    expect(deep).toEqual([]);
  });
});
