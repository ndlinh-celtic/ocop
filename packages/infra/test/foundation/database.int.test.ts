import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkDatabase } from "../../src";
import { createTestDatabase, type TestDatabase } from "../support";

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(() => db.drop());

describe("foundation database", () => {
  it("the app role can connect and the health check passes", async () => {
    await expect(checkDatabase(db.app)).resolves.toBeUndefined();
  });

  it("the app role cannot change the schema", async () => {
    await expect(db.app.query("CREATE TABLE identity.should_fail (id int)")).rejects.toThrow(/permission denied/);
  });

  it("enables the extensions needed for Vietnamese search and emails", async () => {
    const { rows } = await db.admin.query<{ extname: string }>("SELECT extname FROM pg_extension");
    expect(rows.map((r) => r.extname)).toEqual(expect.arrayContaining(["citext", "unaccent", "pg_trgm"]));
  });
});

describe("foundation job queue", () => {
  it("the app role runs pg-boss without DDL: send and work a job", async () => {
    const { createBoss } = await import("../../src");
    const boss = createBoss(db.url("app"), { supervise: false, schedule: false });
    await boss.start();
    try {
      const done = new Promise<unknown>((resolve) => {
        void boss.work("system.ping", async ([job]) => resolve(job?.data));
      });
      await boss.send("system.ping", { hello: "ocop" });
      await expect(done).resolves.toEqual({ hello: "ocop" });
    } finally {
      await boss.stop({ graceful: false });
    }
  });
});
