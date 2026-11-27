import { numeric, timestamp } from "drizzle-orm/pg-core";

// The tables mirror the reviewed SQL in migrations/; the SQL is the source of truth.
export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Phiên bản tiêu chí (0010_criteria.sql). Points are numeric(7,2), read as JS numbers.
export const pts = (name: string) => numeric(name, { precision: 7, scale: 2, mode: "number" });
