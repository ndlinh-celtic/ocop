import { randomUUID } from "node:crypto";
import { checkDatabase, createApp, createBoss, createPool, ensureBucket, loadConfig, s3SettingsFrom, startWorkers } from "@ocop/infra";
import { systemActor } from "@ocop/core";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
await checkDatabase(pool);
const core = createApp(pool, config);

// Local runs only: staging/prod buckets and their CORS rules are provisioned by ops.
const s3 = s3SettingsFrom(config);
if (process.env.S3_AUTO_CREATE_BUCKETS === "true" && s3) {
  const origins = config.S3_CORS_ORIGINS.split(",").map((o) => o.trim());
  await ensureBucket(s3, config.S3_BUCKET_EVIDENCE, { corsOrigins: origins });
  // Browsers never touch the anchor bucket: no CORS.
  await ensureBucket(s3, config.S3_BUCKET_AUDIT_ANCHOR, { corsOrigins: [] });
}
await core.system.recordStartup(systemActor("worker", { requestId: randomUUID(), userAgent: "process:worker" }), { process: "worker" });

const boss = createBoss(config.DATABASE_URL);
boss.on("error", (err) => console.error("pg-boss error", err));
await boss.start();
await boss.work("system.ping", async ([job]) => {
  console.log("system.ping", job?.data);
});
const stopWorkers = await startWorkers(core, pool, boss);
console.log("worker started");

const shutdown = async () => {
  stopWorkers();
  await boss.stop({ graceful: true, timeout: 10_000 });
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
