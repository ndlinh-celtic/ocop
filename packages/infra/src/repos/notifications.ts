import type { Notification, NotificationRepo } from "@ocop/core";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/types";
import { notification } from "../db/schema";

export function notificationRepo(db: Db): NotificationRepo {
  return {
    async insert(n) {
      await db.insert(notification).values(n);
    },
    async listForUser(userId, limit) {
      return (await db
        .select()
        .from(notification)
        .where(eq(notification.userId, userId))
        .orderBy(desc(notification.createdAt), desc(notification.id))
        .limit(limit)) as Notification[];
    },
    async countUnread(userId) {
      const [row] = await db
        .select({ n: count() })
        .from(notification)
        .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
      return row?.n ?? 0;
    },
    async markRead(userId, id, at) {
      const [existing] = await db
        .select({ readAt: notification.readAt })
        .from(notification)
        .where(and(eq(notification.id, id), eq(notification.userId, userId)));
      if (!existing) return false;
      if (!existing.readAt) await db.update(notification).set({ readAt: at }).where(eq(notification.id, id));
      return true;
    },
    async markAllRead(userId, at) {
      await db
        .update(notification)
        .set({ readAt: at })
        .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
    },
  };
}
