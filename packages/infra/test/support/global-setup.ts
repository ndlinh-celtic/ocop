import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { migrate, migrationsDir } from "../../src/db/migrator";
import { ensureBucket } from "../../src/files/s3";
import { installJobQueue } from "../../src/jobs/boss";
import { bootstrapRoles, ROLE_PASSWORDS } from "./bootstrap";

export const TEMPLATE_DB = "ocop_template";
export const TEST_BUCKET = "ocop-evidence-test";

declare module "vitest" {
  export interface ProvidedContext {
    pg: { host: string; port: number; adminUser: string; adminPassword: string };
    s3: { endpoint: string; accessKeyId: string; secretAccessKey: string };
  }
}

let container: StartedPostgreSqlContainer | undefined;
let s3: StartedTestContainer | undefined;

const S3_KEY = "ocop-test";
const S3_SECRET = "ocop-test-secret";

/** One Postgres per test run; a migrated template database that each test file clones. */
export default async function setup(project: TestProject) {
  // Same S3 server as compose.yaml; skipped when the suite targets a real provider.
  const s3Start = process.env.S3_COMPAT_ENDPOINT
    ? Promise.resolve(undefined)
    : new GenericContainer("rustfs/rustfs:1.0.3")
        .withEnvironment({ RUSTFS_ACCESS_KEY: S3_KEY, RUSTFS_SECRET_KEY: S3_SECRET })
        .withExposedPorts(9000)
        .withWaitStrategy(Wait.forHttp("/health", 9000))
        .start();
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
  s3 = await s3Start;
  const endpoint = s3 ? `http://${s3.getHost()}:${s3.getMappedPort(9000)}` : "";
  if (s3) {
    const settings = { endpoint, region: "us-east-1", accessKeyId: S3_KEY, secretAccessKey: S3_SECRET, forcePathStyle: true };
    await ensureBucket(settings, TEST_BUCKET, { corsOrigins: ["http://localhost:8080"] });
  }
  project.provide("s3", { endpoint, accessKeyId: S3_KEY, secretAccessKey: S3_SECRET });
  return async () => {
    await Promise.all([container?.stop(), s3?.stop()]);
  };
}
