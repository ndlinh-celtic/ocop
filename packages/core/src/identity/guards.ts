import type { Actor, UserActor } from "../shared/context";
import { forbidden } from "../shared/errors";

/** Interim guard until the policy table of ticket "Phân vai" replaces it. */
export function requireAdmin(actor: Actor): asserts actor is UserActor {
  if (actor.kind !== "user" || actor.activeRole !== "admin") throw forbidden();
}
