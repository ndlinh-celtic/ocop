import { roundAlreadyOpen, type Round, type RoundRepo } from "@ocop/core";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { round } from "../db/schema";

type Row = typeof round.$inferSelect;

const toRound = ({ aggregationMethod, minGraders, deviationFlagPoints, ...row }: Row): Round => ({
  ...row,
  aggregation: { method: aggregationMethod, minGraders, deviationFlagPoints },
});

const toRow = ({ aggregation, ...r }: Round): Row => ({
  ...r,
  aggregationMethod: aggregation.method,
  minGraders: aggregation.minGraders,
  deviationFlagPoints: aggregation.deviationFlagPoints,
});

/** The partial unique index `round_one_open` refused a second round Đang nhận nộp (a concurrent open). */
const isOneOpenViolation = (err: unknown) => {
  const cause = (err as { cause?: unknown }).cause ?? err;
  const e = cause as { code?: string; constraint?: string };
  return e.code === "23505" && e.constraint === "round_one_open";
};

async function guardOneOpen(write: () => Promise<unknown>) {
  try {
    await write();
  } catch (err) {
    if (isOneOpenViolation(err)) throw roundAlreadyOpen();
    throw err;
  }
}

export function roundRepo(db: Db): RoundRepo {
  return {
    async insert(r) {
      await guardOneOpen(() => db.insert(round).values(toRow(r)));
    },
    async update(r) {
      const { id, createdAt: _c, createdBy: _b, ...fields } = toRow(r);
      await guardOneOpen(() => db.update(round).set(fields).where(eq(round.id, id)));
    },
    async delete(id) {
      await db.delete(round).where(eq(round.id, id));
    },
    async findById(id) {
      const [row] = await db.select().from(round).where(eq(round.id, id));
      return row ? toRound(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(round).where(eq(round.id, id)).for("update");
      return row ? toRound(row) : null;
    },
    async list() {
      return (await db.select().from(round).orderBy(desc(round.year), desc(round.createdAt))).map(toRound);
    },
    async findOpen() {
      const [row] = await db.select().from(round).where(eq(round.status, "open_for_submission"));
      return row ? toRound(row) : null;
    },
  };
}
