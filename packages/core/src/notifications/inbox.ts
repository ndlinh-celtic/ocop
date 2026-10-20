import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";

export function listNotifications(deps: CoreDeps) {
  return async (actor: Actor, opts: { limit?: number } = {}) => {
    authorize(actor, "notification.read_own");
    return deps.uow.run((tx) => tx.notifications.listForUser(actor.userId, Math.min(opts.limit ?? 50, 200)));
  };
}

export function unreadCount(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "notification.read_own");
    return deps.uow.run((tx) => tx.notifications.countUnread(actor.userId));
  };
}

export function markRead(deps: CoreDeps) {
  return async (actor: Actor, input: { id: string }) => {
    authorize(actor, "notification.read_own");
    const { id } = input;
    return deps.uow.run(async (tx) => {
      if (!(await tx.notifications.markRead(actor.userId, id, deps.clock.now()))) {
        throw new DomainError("not_found", "Không tìm thấy thông báo");
      }
    });
  };
}

export function markAllRead(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "notification.read_own");
    return deps.uow.run((tx) => tx.notifications.markAllRead(actor.userId, deps.clock.now()));
  };
}
