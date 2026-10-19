import { checkDatabase, createBoss, createPool, loadConfig } from "@ocop/infra";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
await checkDatabase(pool);

const boss = createBoss(config.DATABASE_URL);
boss.on("error", (err) => console.error("pg-boss error", err));
await boss.start();
await boss.work("system.ping", async ([job]) => {
  console.log("system.ping", job?.data);
});
console.log("worker started");

const shutdown = async () => {
  await boss.stop({ graceful: true, timeout: 10_000 });
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
