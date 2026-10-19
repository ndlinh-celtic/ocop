import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { migrate, migrationsDir } from "../../src/db/migrator";
import { installJobQueue } from "../../src/jobs/boss";
import { bootstrapRoles, ROLE_PASSWORDS } from "./bootstrap";

export const TEMPLATE_DB = "ocop_template";

declare module "vitest" {
  export interface ProvidedContext {
    pg: { host: string; port: number; adminUser: string; adminPassword: string };
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** One Postgres per test run; a migrated template database that each test file clones. */
export default async function setup(project: TestProject) {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const host = container.getHost();
  const port = container.getPort();
  const adminUser = container.getUsername();
  const adminPassword = container.getPassword();

  const admin = new pg.Client({ host, port, user: adminUser, password: adminPassword, database: "postgres" });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();

  const adminTpl = new pg.Client({ host, port, user: adminUser, password: adminPassword, database: TEMPLATE_DB });
  await adminTpl.connect();
  await bootstrapRoles(adminTpl, TEMPLATE_DB);
  await adminTpl.end();

  const migrator = new pg.Pool({ host, port, user: "ocop_migrator", password: ROLE_PASSWORDS.migrator_password, database: TEMPLATE_DB, max: 1 });
  await migrate(migrator, migrationsDir);
  await migrator.end();
  await installJobQueue(`postgres://ocop_migrator:${ROLE_PASSWORDS.migrator_password}@${host}:${port}/${TEMPLATE_DB}`);

  project.provide("pg", { host, port, adminUser, adminPassword });
  return async () => {
    await container?.stop();
  };
}
