/** An in-app notification for one Người dùng (DC-01). */
export interface Notification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationRepo {
  insert(n: Notification): Promise<void>;
  listForUser(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  /** Marks read only if it belongs to the user; false when it does not exist for them. */
  markRead(userId: string, id: string, at: Date): Promise<boolean>;
  markAllRead(userId: string, at: Date): Promise<void>;
}
