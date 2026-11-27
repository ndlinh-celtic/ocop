import { pgSchema, text, uuid } from "drizzle-orm/pg-core";

export const org = pgSchema("org");

export const ward = org.table("ward", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
});
