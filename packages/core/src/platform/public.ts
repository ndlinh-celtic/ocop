// The public interface of the platform module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export type { Consumer, ConsumerContext } from "./consumer-context";
export type { ScheduledJob } from "./jobs";
export type { DomainEvent, EventType, Outbox, ProcessedEvents } from "./events";
export type { DeliveryStatus, EmailDeliveries, EmailDelivery, EmailMessage, Mailer } from "./mail";
export type { RateLimit, RateLimitRepo } from "./rate-limit";
export { consumeRateLimit } from "./throttle";
export type { ResultOutcome } from "./events";
