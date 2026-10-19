import type { Role, RoleAssignment, RoleAssignmentRepo, ScopeType, Session, SessionRepo, User, UserRepo } from "@ocop/core";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { roleAssignment, session, userAccount } from "../db/schema";

export function userRepo(db: Db): UserRepo {
  return {
    async insert(u) {
      await db.insert(userAccount).values(u);
    },
    async findById(id) {
      const [row] = await db.select().from(userAccount).where(eq(userAccount.id, id));
      return (row as User | undefined) ?? null;
    },
    async findByEmail(email) {
      // citext column: equality is case-insensitive.
      const [row] = await db.select().from(userAccount).where(sql`${userAccount.email} = ${email}::citext`);
      return (row as User | undefined) ?? null;
    },
  };
}

const toAssignment = (r: typeof roleAssignment.$inferSelect): RoleAssignment => ({
  ...r,
  role: r.role as Role,
  scopeType: r.scopeType as ScopeType,
});

export function roleAssignmentRepo(db: Db): RoleAssignmentRepo {
  return {
    async insert(a) {
      await db.insert(roleAssignment).values(a);
    },
    async findById(id) {
      const [row] = await db.select().from(roleAssignment).where(eq(roleAssignment.id, id));
      return row ? toAssignment(row) : null;
    },
    async listForUser(userId) {
      const rows = await db.select().from(roleAssignment).where(eq(roleAssignment.userId, userId)).orderBy(roleAssignment.createdAt);
      return rows.map(toAssignment);
    },
    async existsActiveWithRole(role, at) {
      const [row] = await db
        .select({ id: roleAssignment.id })
        .from(roleAssignment)
        .where(
          and(
            eq(roleAssignment.role, role),
            lte(roleAssignment.validFrom, at),
            or(isNull(roleAssignment.validTo), gt(roleAssignment.validTo, at)),
          ),
        )
        .limit(1);
      return row !== undefined;
    },
  };
}

export function sessionRepo(db: Db): SessionRepo {
  return {
    async insert(s) {
      await db.insert(session).values(s);
    },
    async findByTokenHash(hash) {
      const [row] = await db.select().from(session).where(eq(session.tokenHash, hash));
      return (row as Session | undefined) ?? null;
    },
    async revoke(id, at) {
      await db.update(session).set({ revokedAt: at }).where(and(eq(session.id, id), isNull(session.revokedAt)));
    },
  };
}
