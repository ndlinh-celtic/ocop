import { PgBoss } from "pg-boss";

export const BOSS_SCHEMA = "pgboss";

/** Every queue the worker consumes. Created by the migrator so the app role never needs DDL. */
export const QUEUES = ["system.ping"] as const;
export type QueueName = (typeof QUEUES)[number];

/**
 * Installs or upgrades the pg-boss schema and queues as the migrator, then grants the app role
 * data access only. Runs in the `migrate` container right after the SQL migrations.
 */
export async function installJobQueue(migratorUrl: string): Promise<void> {
  const boss = new PgBoss({ connectionString: migratorUrl, schema: BOSS_SCHEMA, supervise: false, schedule: false, max: 1 });
  boss.on("error", (err) => console.error("pg-boss install error", err));
  await boss.start();
  for (const name of QUEUES) {
    if (!(await boss.getQueue(name))) await boss.createQueue(name);
  }
  await boss.stop({ graceful: false });

  const { Client } = await import("pg");
  const client = new Client({ connectionString: migratorUrl });
  await client.connect();
  try {
    await client.query(`
      GRANT USAGE ON SCHEMA ${BOSS_SCHEMA} TO ocop_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${BOSS_SCHEMA} TO ocop_app;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${BOSS_SCHEMA} TO ocop_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${BOSS_SCHEMA} TO ocop_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${BOSS_SCHEMA} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ocop_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${BOSS_SCHEMA} GRANT USAGE, SELECT ON SEQUENCES TO ocop_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${BOSS_SCHEMA} GRANT EXECUTE ON FUNCTIONS TO ocop_app;
    `);
  } finally {
    await client.end();
  }
}

/** pg-boss as the app role: never migrates, so a missing grant fails loudly instead of running DDL. */
export function createBoss(appUrl: string, opts: { supervise?: boolean; schedule?: boolean } = {}): PgBoss {
  return new PgBoss({
    connectionString: appUrl,
    schema: BOSS_SCHEMA,
    migrate: false,
    supervise: opts.supervise ?? true,
    schedule: opts.schedule ?? true,
  });
}

export type { PgBoss };
