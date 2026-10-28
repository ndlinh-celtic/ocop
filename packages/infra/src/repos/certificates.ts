import type { Certificate, CertificateRepo } from "@ocop/core";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import { certCounter, certificate as c, certificateSignedFile as sf } from "../db/schema";

/** Giấy chứng nhận (#84): the DB keeps the số hiệu, hồ sơ and Hạng công nhận as issued, and every signed PDF. */
export function certificateRepo(db: Db): CertificateRepo {
  const asCertificate = (row: typeof c.$inferSelect): Certificate => row;
  return {
    async nextSeq(year) {
      // The counter row stays locked until the recording commits, so concurrent quyết định take turns (story 25).
      const [row] = await db
        .insert(certCounter)
        .values({ year, lastSeq: 1 })
        .onConflictDoUpdate({ target: certCounter.year, set: { lastSeq: sql`${certCounter.lastSeq} + 1` } })
        .returning({ n: certCounter.lastSeq });
      return row!.n;
    },
    async insert(cert) {
      await db.insert(c).values(cert);
    },
    async findById(id) {
      const [row] = await db.select().from(c).where(eq(c.id, id));
      return row ? asCertificate(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(c).where(eq(c.id, id)).for("update");
      return row ? asCertificate(row) : null;
    },
    async ofDossier(dossierId) {
      const [row] = await db.select().from(c).where(eq(c.dossierId, dossierId));
      return row ? asCertificate(row) : null;
    },
    async ofDecision(decisionId) {
      return db.select().from(c).where(eq(c.decisionId, decisionId)).orderBy(asc(c.seq));
    },
    async list(filter) {
      const where: SQL[] = [];
      if (filter.year !== undefined) where.push(eq(c.year, filter.year));
      if (filter.state !== undefined) where.push(eq(c.state, filter.state));
      if (filter.decisionId !== undefined) where.push(eq(c.decisionId, filter.decisionId));
      return db
        .select()
        .from(c)
        .where(and(...where))
        .orderBy(desc(c.year), asc(c.seq));
    },
    async update(cert) {
      // Only the columns ocop_app may UPDATE (0048_certificate.sql).
      await db
        .update(c)
        .set({
          issuedOn: cert.issuedOn,
          expiresOn: cert.expiresOn,
          state: cert.state,
          draftFileId: cert.draftFileId,
          templateVersionId: cert.templateVersionId,
        })
        .where(eq(c.id, cert.id));
    },
    async signedFiles(certificateId) {
      return db.select().from(sf).where(eq(sf.certificateId, certificateId)).orderBy(asc(sf.n));
    },
    async addSignedFile(f) {
      await db.insert(sf).values(f);
    },
  };
}
