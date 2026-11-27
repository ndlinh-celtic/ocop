// The Drizzle tables, one file per Postgres schema (#95): a new table lands in its module's file. They mirror the
// reviewed SQL in migrations/; the SQL is the source of truth.
export * from "./tables/identity";
export * from "./tables/platform";
export * from "./tables/org";
export * from "./tables/criteria";
export * from "./tables/rounds";
export * from "./tables/entities";
export * from "./tables/councils";
export * from "./tables/scoring";
export * from "./tables/dossiers";
export * from "./tables/results";
