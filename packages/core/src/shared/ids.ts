import type { DomainError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` has the shape of a UUID, the type of every id column (ADR 0004). */
export const isUuid = (id: unknown): id is string => typeof id === "string" && UUID.test(id);

/**
 * Ids reach use cases from URLs and forms. One that is not a UUID names nothing, so it is refused with the
 * caller's not-found error before it reaches a uuid column, where Postgres would fail the query instead.
 */
export function assertIdShape(id: unknown, notFound: () => DomainError): asserts id is string {
  if (!isUuid(id)) throw notFound();
}
