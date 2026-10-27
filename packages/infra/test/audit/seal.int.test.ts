import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, minutes, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const seconds = (n: number) => n * 1000;

describe("ADR 0002 sealing the audit log", () => {
  it("seals only rows older than 30 seconds, in batches, each with a checkpoint", async () => {
    await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.audit.seal(systemActor("audit.seal"))).resolves.toMatchObject({ sealed: 0 });
    t.clock.advance(seconds(31));
    await t.signInAs(ADMIN.email, ADMIN.password); // a fresh row, still inside the window
    const first = await t.app.audit.seal(systemActor("audit.seal"));
    expect(first.sealed).toBeGreaterThanOrEqual(2);
    t.clock.advance(seconds(31));
    const second = await t.app.audit.seal(systemActor("audit.seal"));
    expect(second.sealed).toBeGreaterThanOrEqual(1);
    expect(second.lastSeq).toBe(first.lastSeq + second.sealed);
  });

  it("a row that commits late, with an earlier timestamp, is sealed in the next batch rather than skipped", async () => {
    const now = t.clock.now();
    t.clock.set(new Date(now.getTime() - minutes(10)));
    await t.app.identity.signIn(anonymous(), { email: ADMIN.email, password: "sai-mat-khau-day" }); // stamped 10 minutes ago
    t.clock.set(now);
    const batch = await t.app.audit.seal(systemActor("audit.seal"));
    expect(batch.sealed).toBeGreaterThanOrEqual(1);
    await expect(t.app.audit.verify(systemActor("audit.verify"))).resolves.toMatchObject({ ok: true });
  });

  it("verification passes for an untouched chain and pinpoints a rewritten row", async () => {
    t.clock.advance(seconds(31));
    await t.app.audit.seal(systemActor("audit.seal"));
    const ok = await t.app.audit.verify(systemActor("audit.verify"));
    expect(ok).toMatchObject({ ok: true });
    expect(ok.checked).toBeGreaterThan(3);

    // Someone with superuser rights bypasses the triggers and edits history.
    const client = await db.admin.connect();
    try {
      await client.query("SET session_replication_role = replica");
      const { rows } = await client.query("SELECT s.seq, s.audit_id FROM platform.audit_seal s ORDER BY s.seq LIMIT 1 OFFSET 2");
      const edit = await client.query("UPDATE platform.audit_log SET action = action || '.edited' WHERE id = $1", [rows[0].audit_id]);
      expect(edit.rowCount).toBe(1);
      const broken = await t.app.audit.verify(systemActor("audit.verify"));
      expect(broken).toMatchObject({ ok: false, brokenAtSeq: Number(rows[0].seq), reason: "hash_mismatch" });

      await client.query("DELETE FROM platform.audit_log WHERE id = $1", [rows[0].audit_id]);
      await expect(t.app.audit.verify(systemActor("audit.verify"))).resolves.toMatchObject({
        ok: false,
        brokenAtSeq: Number(rows[0].seq),
        reason: "row_missing",
      });
    } finally {
      client.release();
    }
  });

  it("records a broken chain in the audit log", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const [entry] = await t.app.audit.search(admin, { action: ["audit.chain.broken"] });
    expect(entry?.metadata).toMatchObject({ reason: expect.any(String) });
  });

  it("the app role can add seals but never change or remove them", async () => {
    await expect(db.app.query("UPDATE platform.audit_seal SET hash = 'x'")).rejects.toThrow();
    await expect(db.app.query("DELETE FROM platform.audit_seal")).rejects.toThrow();
  });
});

describe("ADR 0002 daily anchor outside the database", () => {
  it("writes the last sealed hash of the day to the anchor bucket and audits it", async () => {
    const fresh = await createTestDatabase();
    const a = createTestApp(fresh, { totpRequired: false });
    try {
      await a.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
      a.clock.advance(seconds(31));
      const sealed = await a.app.audit.seal(systemActor("audit.seal"));
      const anchor = await a.app.audit.anchor(systemActor("audit.anchor"));
      expect(anchor).toMatchObject({ lastSeq: sealed.lastSeq, lastHash: sealed.lastHash, key: expect.stringMatching(/^anchors\/\d{4}-\d{2}-\d{2}/) });
      const stored = JSON.parse(await a.readAnchor(anchor!.key));
      expect(stored).toMatchObject({ lastSeq: sealed.lastSeq, lastHash: sealed.lastHash });
    } finally {
      await a.stop();
      await fresh.drop();
    }
  });

  it("run just after midnight, it names the day that ended and covers rows from its last seconds", async () => {
    const fresh = await createTestDatabase();
    const a = createTestApp(fresh, { totpRequired: false });
    try {
      a.clock.set(new Date("2026-10-20T23:59:50+07:00"));
      await a.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
      a.clock.set(new Date("2026-10-21T00:05:00+07:00"));
      const anchor = await a.app.audit.anchor(systemActor("audit.anchor")); // no seal ran since the row was written
      expect(anchor?.key).toMatch(/^anchors\/2026-10-20-/);
      const verified = await a.app.audit.verify(systemActor("audit.verify"));
      expect(verified).toMatchObject({ ok: true, lastSeq: anchor!.lastSeq });
      expect(anchor!.lastSeq).toBeGreaterThan(0);
    } finally {
      await a.stop();
      await fresh.drop();
    }
  });
});

describe("ADR 0002 verifying from a checkpoint", () => {
  it("recomputes only the seals after the last checkpoint before the given time", async () => {
    const fresh = await createTestDatabase();
    const a = createTestApp(fresh, { totpRequired: false });
    try {
      await a.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
      a.clock.advance(seconds(31));
      await a.app.audit.seal(systemActor("audit.seal"));
      const afterFirst = a.clock.now();
      a.clock.advance(minutes(1));
      await a.signInAs(ADMIN.email, ADMIN.password);
      a.clock.advance(seconds(31));
      const second = await a.app.audit.seal(systemActor("audit.seal"));
      expect(second.sealed).toBeGreaterThan(0);

      const partial = await a.app.audit.verify(systemActor("audit.verify"), { since: new Date(afterFirst.getTime() + 1) });
      expect(partial).toMatchObject({ ok: true, checked: second.sealed, lastSeq: second.lastSeq });
    } finally {
      await a.stop();
      await fresh.drop();
    }
  });

  it("refuses a checkpoint whose hash no longer matches its seal", async () => {
    const fresh = await createTestDatabase();
    const a = createTestApp(fresh, { totpRequired: false });
    try {
      await a.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
      a.clock.advance(seconds(31));
      const first = await a.app.audit.seal(systemActor("audit.seal"));
      const client = await fresh.admin.connect();
      try {
        await client.query("SET session_replication_role = replica");
        await client.query("UPDATE platform.audit_checkpoint SET last_hash = repeat('0', 64)");
      } finally {
        client.release();
      }
      await expect(a.app.audit.verify(systemActor("audit.verify"), { since: new Date(a.clock.now().getTime() + 1) })).resolves.toMatchObject({
        ok: false,
        brokenAtSeq: first.lastSeq,
        reason: "checkpoint_mismatch",
      });
    } finally {
      await a.stop();
      await fresh.drop();
    }
  });
});

describe("L21 audit search", () => {
  it("filters by user, object and time range", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const byUser = await t.app.audit.search(admin, { actorUserId: admin.userId });
    expect(byUser.length).toBeGreaterThan(0);
    expect(byUser.every((e) => e.actorUserId === admin.userId)).toBe(true);
    const future = await t.app.audit.search(admin, { from: new Date(t.clock.now().getTime() + minutes(60)) });
    expect(future).toEqual([]);
    const bySession = await t.app.audit.search(admin, { targetType: "session", targetId: admin.sessionId });
    expect(bySession.map((e) => e.action)).toContain("auth.sign_in.succeeded");
  });
});
