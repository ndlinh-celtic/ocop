import { randomBytes } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";
import { ROLE_PASSWORDS } from "./bootstrap";

const TEMPLATE_DB = "ocop_template";

export interface TestDatabase {
  name: string;
  /** Connects as ocop_app, exactly like the running application. */
  app: pg.Pool;
  /** Superuser, for assertions and fixtures that the app itself must not be able to do. */
  admin: pg.Pool;
  url(role: "app" | "migrator"): string;
  drop(): Promise<void>;
}

/** Clones the migrated template into a fresh database, so test files never share state. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const { host, port, adminUser, adminPassword } = inject("pg");
  const name = `t_${randomBytes(6).toString("hex")}`;
  const root = new pg.Client({ host, port, user: adminUser, password: adminPassword, database: "postgres" });
  await root.connect();
  await root.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB} OWNER ocop_migrator`);
  await root.end();

  const url = (role: "app" | "migrator") => {
    const password = role === "app" ? ROLE_PASSWORDS.app_password : ROLE_PASSWORDS.migrator_password;
    return `postgres://ocop_${role}:${password}@${host}:${port}/${name}`;
  };
  const app = new pg.Pool({ connectionString: url("app"), max: 5 });
  const admin = new pg.Pool({ host, port, user: adminUser, password: adminPassword, database: name, max: 2 });

  return {
    name,
    app,
    admin,
    url,
    async drop() {
      await app.end();
      await admin.end();
      const r = new pg.Client({ host, port, user: adminUser, password: adminPassword, database: "postgres" });
      await r.connect();
      await r.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await r.end();
    },
  };
}
