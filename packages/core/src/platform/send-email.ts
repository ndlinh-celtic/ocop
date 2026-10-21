import type { EmailDelivery, EmailMessage } from "./mail";
import type { ConsumerContext } from "./consumer-context";

type SendContext = Pick<ConsumerContext, "deps" | "tx" | "event" | "consumer">;

/** Sends; a failure is recorded in its own transaction and rethrown so the job is retried. */
async function deliver({ deps, event, consumer }: SendContext, message: EmailMessage, recordSent: (d: EmailDelivery) => Promise<void>) {
  const base = { eventId: event.id, consumer, recipient: message.to, template: message.template };
  try {
    await deps.mailer.send(message);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await deps.uow.run((t) => t.emailDeliveries.record({ ...base, id: deps.ids.next(), status: "failed", error, attemptedAt: deps.clock.now() }));
    throw err;
  }
  await recordSent({ ...base, id: deps.ids.next(), status: "sent", error: null, attemptedAt: deps.clock.now() });
}

/**
 * Sends inside the consumer's transaction: on success the delivery is recorded with it; on failure
 * the failure is recorded in its own transaction and the error rethrown so the job is retried.
 */
export async function sendEmail(c: SendContext, message: EmailMessage) {
  await deliver(c, message, (d) => c.tx.emailDeliveries.record(d));
}

/**
 * For a consumer that emails several recipients and writes nothing else: sends to `message.to` at most
 * once per event, across retries. A delivery is recorded as sent in its own transaction as soon as it
 * succeeds, so a failure on a later recipient, which rolls the consumer's transaction back and retries
 * the job, does not send again to those already reached.
 */
export async function sendEmailOnce(c: SendContext, message: EmailMessage) {
  if (await c.tx.emailDeliveries.wasSent(c.event.id, c.consumer, message.to)) return;
  await deliver(c, message, (d) => c.deps.uow.run((t) => t.emailDeliveries.record(d)));
}
