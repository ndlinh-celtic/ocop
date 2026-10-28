import type { RecognitionDecisionRepo } from "@ocop/core";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { recognitionDecision as d, recognitionDecisionDossier as dd } from "../db/schema";

/** Quyết định công nhận (#83): the DB keeps one per Phiên họp and refuses removing it or changing its hồ sơ. */
export function recognitionDecisionRepo(db: Db): RecognitionDecisionRepo {
  return {
    async insert(decision, dossiers) {
      // A second decision of the same Phiên họp loses on the partial unique index and inserts nothing.
      const inserted = await db
        .insert(d)
        .values(decision)
        .onConflictDoNothing({ target: d.meetingId, where: eq(d.kind, "meeting") })
        .returning({ id: d.id });
      if (inserted.length !== 1) return false;
      if (dossiers.length > 0) await db.insert(dd).values([...dossiers]);
      return true;
    },
    async findById(id) {
      const [row] = await db.select().from(d).where(eq(d.id, id));
      return row ?? null;
    },
    async ofMeeting(meetingId) {
      const [row] = await db
        .select()
        .from(d)
        .where(and(eq(d.meetingId, meetingId), eq(d.kind, "meeting")));
      return row ?? null;
    },
    async dossiers(decisionId) {
      return db.select().from(dd).where(eq(dd.decisionId, decisionId)).orderBy(asc(dd.dossierId));
    },
    async ofDossier(dossierId) {
      const rows = await db
        .select({ decision: d, section: dd.section })
        .from(dd)
        .innerJoin(d, eq(d.id, dd.decisionId))
        .where(eq(dd.dossierId, dossierId))
        .orderBy(asc(d.recordedAt), asc(d.id));
      return rows.map((r) => ({ ...r.decision, section: r.section }));
    },
    async lock(id) {
      const [row] = await db.select().from(d).where(eq(d.id, id)).for("update");
      return row ?? null;
    },
    async amend(id, fields) {
      await db.update(d).set({ number: fields.number, signedOn: fields.signedOn }).where(eq(d.id, id));
    },
  };
}
