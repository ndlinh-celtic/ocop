import type { OneTimeToken, OneTimeTokenRepo, Role, RoleAssignment, RoleAssignmentRepo, ScopeType, Session, SessionRepo, User, UserRepo } from "@ocop/core";
import { and, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { oneTimeToken, roleAssignment, session, userAccount } from "../db/schema";

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
    async update(id, patch) {
      await db.update(userAccount).set(patch).where(eq(userAccount.id, id));
    },
    async list() {
      return (await db.select().from(userAccount).orderBy(userAccount.fullName)) as User[];
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
    async listForScope(role, scopeType, scopeId) {
      const rows = await db
        .select()
        .from(roleAssignment)
        .where(and(eq(roleAssignment.role, role), eq(roleAssignment.scopeType, scopeType), eq(roleAssignment.scopeId, scopeId)))
        .orderBy(roleAssignment.createdAt);
      return rows.map(toAssignment);
    },
    async end(id, validTo) {
      await db.update(roleAssignment).set({ validTo }).where(eq(roleAssignment.id, id));
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
    async findById(id) {
      const [row] = await db.select().from(session).where(eq(session.id, id));
      return (row as Session | undefined) ?? null;
    },
    async update(id, patch) {
      await db.update(session).set(patch).where(eq(session.id, id));
    },
    async revokeAllForUserExcept(userId, keepSessionId, at) {
      await db
        .update(session)
        .set({ revokedAt: at })
        .where(and(eq(session.userId, userId), isNull(session.revokedAt), ne(session.id, keepSessionId)));
    },
    async revokeAllForUser(userId, at) {
      await db.update(session).set({ revokedAt: at }).where(and(eq(session.userId, userId), isNull(session.revokedAt)));
    },
    async revoke(id, at) {
      await db.update(session).set({ revokedAt: at }).where(and(eq(session.id, id), isNull(session.revokedAt)));
    },
  };
}

export function oneTimeTokenRepo(db: Db): OneTimeTokenRepo {
  return {
    async insert(t) {
      await db.insert(oneTimeToken).values(t);
    },
    async findByHash(hash) {
      const [row] = await db.select().from(oneTimeToken).where(eq(oneTimeToken.tokenHash, hash));
      return (row as OneTimeToken | undefined) ?? null;
    },
    async markUsed(id, at) {
      await db.update(oneTimeToken).set({ usedAt: at }).where(eq(oneTimeToken.id, id));
    },
    async invalidateOpen(userId, purpose, at) {
      await db
        .update(oneTimeToken)
        .set({ invalidatedAt: at })
        .where(and(eq(oneTimeToken.userId, userId), eq(oneTimeToken.purpose, purpose), isNull(oneTimeToken.usedAt), isNull(oneTimeToken.invalidatedAt)));
    },
  };
}
