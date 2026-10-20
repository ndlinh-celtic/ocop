import { randomUUID } from "node:crypto";
import { systemActor, type Core } from "@ocop/core";
import type { Pool } from "pg";

/**
 * Imports a Phiên bản tiêu chí file (QĐ 26 extraction format) as a draft through the core use case, so it
 * is audited like an import by Quản trị. Idempotent: skipped when a version with the same văn bản căn cứ
 * already exists, whatever its status.
 */
export async function seedCriteria(pool: Pool, core: Core, content: string, fileName: string): Promise<{ created: boolean; versionId: string }> {
  const legalBasis = (JSON.parse(content.replace(/^\uFEFF/, "")) as { van_ban?: unknown }).van_ban;
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM criteria.version WHERE legal_basis = $1 ORDER BY created_at LIMIT 1", [legalBasis]);
  if (rows[0]) return { created: false, versionId: rows[0].id };
  const actor = systemActor("seed:criteria", { requestId: randomUUID(), userAgent: "cli:seed:criteria" });
  const { versionId } = await core.criteria.importVersion(actor, { fileName, content });
  return { created: true, versionId };
}
