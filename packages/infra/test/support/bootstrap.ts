import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";

export const ROLE_PASSWORDS = {
  migrator_password: "migrator",
  app_password: "app",
  readonly_password: "readonly",
};

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
const ident = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Runs sql/bootstrap-roles.sql the way psql would, substituting its variables. */
export async function bootstrapRoles(admin: Client, dbName: string): Promise<void> {
  const file = path.resolve(import.meta.dirname, "../../sql/bootstrap-roles.sql");
  const vars: Record<string, string> = { ...ROLE_PASSWORDS, db_name: dbName };
  const sql = (await readFile(file, "utf8"))
    .replace(/:'(\w+)'/g, (_, k: string) => lit(vars[k] ?? ""))
    .replace(/:"(\w+)"/g, (_, k: string) => ident(vars[k] ?? ""));
  await admin.query(sql);
}
