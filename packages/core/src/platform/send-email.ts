import type { EmailMessage } from "./mail";
import type { ConsumerContext } from "./consumer-context";

/**
 * Sends inside the consumer's transaction: on success the delivery is recorded with it; on failure
 * the failure is recorded in its own transaction and the error rethrown so the job is retried.
 */
export async function sendEmail({ deps, tx, event, consumer }: Pick<ConsumerContext, "deps" | "tx" | "event" | "consumer">, message: EmailMessage) {
  const base = { eventId: event.id, consumer, recipient: message.to, template: message.template };
  try {
    await deps.mailer.send(message);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await deps.uow.run((t) => t.emailDeliveries.record({ ...base, id: deps.ids.next(), status: "failed", error, attemptedAt: deps.clock.now() }));
    throw err;
  }
  await tx.emailDeliveries.record({ ...base, id: deps.ids.next(), status: "sent", error: null, attemptedAt: deps.clock.now() });
}
