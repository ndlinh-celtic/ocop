import "server-only";
import { DomainError } from "@ocop/core";

/** Turns a refused rule into a form message; anything else is a bug and propagates. */
export function domainMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  throw err;
}
