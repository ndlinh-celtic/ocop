import { describe, expect, it } from "vitest";
import { createS3FileStore } from "../../src/files/s3";
import { s3TestSettings, systemActor } from "../support";
import { FIVE, resultsWorld } from "./results-world";

/** The evidence bucket of the test app (test/support/app.ts). */
const TEST_BUCKET = "ocop-evidence-test";

/*
 * L17 SO-04 Gói đề nghị 5 sao (#89): a job deletes the ZIP of each package past its hạn tải (7 days) and records it
 * removed. Domestic S3 may not run lifecycle rules, so the job, not the bucket, is what removes the object. It is safe to
 * run again, and safe when the object is already gone.
 */
describe("L17 Gói đề nghị 5 sao (#89): removing packages past their hạn tải", () => {
  const { w, closedMeeting, record } = resultsWorld();
  const JOB = systemActor("results.five-star-packages-expire");
  const DAY = 86_400_000;
  const store = () => createS3FileStore(s3TestSettings(), TEST_BUCKET);

  async function readyPackage() {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    const { packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds: [dossiers[0]!.dossierId] });
    await w.t.drainJobs();
    const { rows } = await w.db.admin.query<{ storage_key: string }>("SELECT storage_key FROM results.five_star_package WHERE id = $1", [packageId]);
    return { packageId, storageKey: rows[0]!.storage_key };
  }

  const removedAt = async (packageId: string) =>
    (await w.db.admin.query<{ removed_at: Date | null }>("SELECT removed_at FROM results.five_star_package WHERE id = $1", [packageId])).rows[0]!.removed_at;

  it("keeps a package until its hạn tải, then deletes its ZIP, records it removed and audits it; a second run does nothing", async () => {
    const { packageId, storageKey } = await readyPackage();

    w.t.clock.advance(7 * DAY - 60_000);
    expect(await w.t.app.results.removeExpiredFiveStarPackages(JOB)).toEqual({ removed: 0 });
    expect(await store().head(storageKey)).not.toBeNull();

    w.t.clock.advance(60_000);
    expect(await w.t.app.results.removeExpiredFiveStarPackages(JOB)).toEqual({ removed: 1 });
    expect(await store().head(storageKey)).toBeNull();
    expect(await removedAt(packageId)).toEqual(w.t.clock.now());
    const audit = await w.db.admin.query("SELECT 1 FROM platform.audit_log WHERE action = 'results.package.removed' AND target_id = $1", [packageId]);
    expect(audit.rowCount).toBe(1);
    await expect(w.t.app.results.downloadFiveStarPackage(w.province, { packageId })).rejects.toMatchObject({ code: "package_expired" });
    expect((await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === packageId)).toMatchObject({ state: "ready", expired: true });

    w.t.clock.advance(DAY);
    expect(await w.t.app.results.removeExpiredFiveStarPackages(JOB)).toEqual({ removed: 0 });
  });

  it("records the package removed when its object is already gone (e.g. a lifecycle rule got there first)", async () => {
    const { packageId, storageKey } = await readyPackage();
    await store().delete(storageKey);

    w.t.clock.advance(7 * DAY);
    expect(await w.t.app.results.removeExpiredFiveStarPackages(JOB)).toEqual({ removed: 1 });
    expect(await removedAt(packageId)).not.toBeNull();
  });

  it("lets the app's database user only mark a ready package removed, once, and change nothing else with it (trigger)", async () => {
    const { packageId } = await readyPackage();

    await expect(w.db.app.query("UPDATE results.five_star_package SET removed_at = now(), storage_key = 'x' WHERE id = $1", [packageId])).rejects.toMatchObject(
      { code: "42501" },
    );
    await w.db.app.query("UPDATE results.five_star_package SET removed_at = now() WHERE id = $1", [packageId]);
    await expect(w.db.app.query("UPDATE results.five_star_package SET removed_at = now() WHERE id = $1", [packageId])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(w.db.app.query("UPDATE results.five_star_package SET removed_at = NULL WHERE id = $1", [packageId])).rejects.toMatchObject({
      code: "42501",
    });
  });
});
