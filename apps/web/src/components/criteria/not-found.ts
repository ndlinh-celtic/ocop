import { DomainError } from "@ocop/core";

/** For pages: a `not_found` from a criteria use case becomes null (then notFound()); anything else propagates. */
export const orNotFound = (err: unknown) => (err instanceof DomainError && err.code === "not_found" ? null : Promise.reject(err));
