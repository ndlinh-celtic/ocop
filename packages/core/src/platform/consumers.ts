import type { SystemActor } from "../shared/context";
import { emailDossierEvent, notifyDossierEvent } from "../dossiers/notices";
import { notifyFileBlocked, scanUploadedFile } from "../files/scan";
import { issueActivationLink } from "../identity/activation-email";
import { emailAccountLocked, emailPasswordReset } from "../identity/passwords";
import { emailRoleGranted, notifyRoleGranted } from "../identity/role-granted";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { ConsumerContext } from "./consumer-context";
import type { EventType } from "./events";

interface Consumer {
  events: readonly EventType[];
  handle(c: ConsumerContext): Promise<void>;
}

/** Each consumer is one job queue; the relay enqueues one job per (event, subscribed consumer). */
export const CONSUMERS = {
  "identity.activation-email": {
    events: ["identity.user.created", "identity.activation.requested"],
    handle: issueActivationLink,
  },
  "identity.role-granted-email": {
    events: ["identity.role.granted"],
    handle: emailRoleGranted,
  },
  "notifications.role-granted": {
    events: ["identity.role.granted"],
    handle: notifyRoleGranted,
  },
  "identity.lockout-email": {
    events: ["identity.user.locked"],
    handle: emailAccountLocked,
  },
  "identity.password-reset-email": {
    events: ["identity.password_reset.requested"],
    handle: emailPasswordReset,
  },
  "files.scan": {
    events: ["files.uploaded"],
    handle: scanUploadedFile,
  },
  "notifications.file-blocked": {
    events: ["files.blocked"],
    handle: notifyFileBlocked,
  },
  // Story 86: Cán bộ xã hear of a new hồ sơ, the Chủ thể of its Tiếp nhận.
  "notifications.dossier": {
    events: ["dossier.submitted", "dossier.received", "dossier.forwarded"],
    handle: notifyDossierEvent,
  },
  "dossiers.notice-email": {
    events: ["dossier.submitted", "dossier.received", "dossier.forwarded"],
    handle: emailDossierEvent,
  },
} as const satisfies Record<string, Consumer>;

export type ConsumerName = keyof typeof CONSUMERS;
export const CONSUMER_NAMES = Object.keys(CONSUMERS) as ConsumerName[];

export const consumersFor = (type: EventType): ConsumerName[] =>
  CONSUMER_NAMES.filter((name) => (CONSUMERS[name].events as readonly EventType[]).includes(type));

/** Runs one consumer for one event, at most once per committed transaction. */
export function handleEvent(deps: CoreDeps) {
  return (_system: SystemActor, input: { consumer: ConsumerName; eventId: string }) =>
    deps.uow.run(async (tx) => {
      const { consumer, eventId } = input;
      const event = await tx.outbox.get(eventId);
      if (!event) throw new DomainError("event_not_found", `Event ${eventId} not in outbox`);
      if (!(await tx.processedEvents.markIfNew(eventId, consumer, deps.clock.now()))) return "skipped" as const;
      await CONSUMERS[consumer].handle({ deps, tx, event, consumer });
      return "handled" as const;
    });
}

