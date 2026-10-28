import type { ReminderRepo, SystemSettingRepo } from "@ocop/core";
import { and, count, eq, gte, inArray, isNull, notExists, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { certificate, dossier, reminderSent, systemSetting } from "../db/schema";

export function reminderRepo(db: Db): ReminderRepo {
  return {
    async entitiesWithDraft(criteriaVersionId) {
      const rows = await db
        .selectDistinct({ entityId: dossier.entityId })
        .from(dossier)
        .where(and(eq(dossier.criteriaVersionId, criteriaVersionId), eq(dossier.state, "draft"), isNull(dossier.deletedAt)));
      return rows.map((r) => r.entityId);
    },
    async openSupplements(now) {
      const rows = await db
        .select({ dossierId: dossier.id, entityId: dossier.entityId, deadline: dossier.supplementDeadline })
        .from(dossier)
        .where(and(eq(dossier.state, "supplement_requested"), gte(dossier.supplementDeadline, now)));
      return rows.flatMap((r) => (r.deadline ? [{ dossierId: r.dossierId, entityId: r.entityId, deadline: r.deadline }] : []));
    },
    async unforwardedByWard(roundId) {
      const rows = await db
        .select({ wardId: dossier.wardId, count: count() })
        .from(dossier)
        .where(and(eq(dossier.roundId, roundId), inArray(dossier.state, ["submitted_to_ward", "supplement_requested"])))
        .groupBy(dossier.wardId);
      return rows.flatMap((r) => (r.wardId ? [{ wardId: r.wardId, count: r.count }] : []));
    },
    async unremindedCertificates(today) {
      // One reminder per giấy, whatever its ngày hết hiệu lực became since (#79 review S1).
      return db
        .select({ certificateId: certificate.id, dossierId: certificate.dossierId, entityId: dossier.entityId, expiresOn: certificate.expiresOn })
        .from(certificate)
        .innerJoin(dossier, eq(dossier.id, certificate.dossierId))
        .where(
          and(
            gte(certificate.expiresOn, today),
            notExists(
              db
                .select({ one: sql`1` })
                .from(reminderSent)
                .where(and(eq(reminderSent.kind, "certificate_expiry"), eq(reminderSent.contextId, certificate.id))),
            ),
          ),
        )
        .orderBy(certificate.expiresOn, certificate.id);
    },
    async record(r) {
      const inserted = await db.insert(reminderSent).values(r).onConflictDoNothing().returning({ kind: reminderSent.kind });
      return inserted.length > 0;
    },
  };
}

export function systemSettingRepo(db: Db): SystemSettingRepo {
  return {
    async get(key) {
      const [row] = await db.select({ value: systemSetting.value }).from(systemSetting).where(eq(systemSetting.key, key));
      return row?.value ?? null;
    },
    async put(key, value, at, by) {
      await db
        .insert(systemSetting)
        .values({ key, value, updatedAt: at, updatedBy: by })
        .onConflictDoUpdate({ target: systemSetting.key, set: { value, updatedAt: at, updatedBy: by } });
    },
  };
}
