import { createPool } from "../src/db/pool";
import { migrate, migrationsDir } from "../src/db/migrator";
import { installJobQueue } from "../src/jobs/boss";

const url = process.env.MIGRATOR_DATABASE_URL;
if (!url) throw new Error("MIGRATOR_DATABASE_URL is required");
const pool = createPool(url, 1);
try {
  const ran = await migrate(pool, migrationsDir);
  console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date");
} finally {
  await pool.end();
}
await installJobQueue(url);
console.log("Job queue schema ready");
