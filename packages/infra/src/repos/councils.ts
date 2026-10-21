import type { AssignmentRepo, CouncilRepo } from "@ocop/core";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/types";
import { assignment, council } from "../db/schema";

export function councilRepo(db: Db): CouncilRepo {
  return {
    async insert(c) {
      await db.insert(council).values(c);
    },
    async update({ id, createdAt: _a, createdBy: _b, ...fields }) {
      await db.update(council).set(fields).where(eq(council.id, id));
    },
    async findById(id) {
      const [row] = await db.select().from(council).where(eq(council.id, id));
      return row ?? null;
    },
    async lock(id) {
      const [row] = await db.select().from(council).where(eq(council.id, id)).for("update");
      return row ?? null;
    },
    async list() {
      return db.select().from(council).orderBy(desc(council.createdAt), desc(council.id));
    },
  };
}

export function assignmentRepo(db: Db): AssignmentRepo {
  return {
    async current(dossierId) {
      return db
        .select()
        .from(assignment)
        .where(and(eq(assignment.dossierId, dossierId), isNull(assignment.replacedAt)))
        .orderBy(asc(assignment.createdAt), asc(assignment.id));
    },
    async insert(a) {
      await db.insert(assignment).values(a);
    },
    async deleteDrafts(ids) {
      if (ids.length === 0) return;
      await db.delete(assignment).where(and(inArray(assignment.id, [...ids]), isNull(assignment.effectiveAt)));
    },
  };
}
