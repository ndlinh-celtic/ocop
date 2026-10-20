import { DomainError } from "@ocop/core";

/**
 * For pages: a `not_found` from a use case becomes null, so the page calls notFound() and Next shows 404;
 * anything else propagates. Usage: `const x = await uc(actor, input).catch(orNotFound); if (!x) notFound();`
 */
export const orNotFound = (err: unknown) => (err instanceof DomainError && err.code === "not_found" ? null : Promise.reject(err));
