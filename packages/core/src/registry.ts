import { auditModule } from "./audit/module";
import { councilsModule } from "./councils/module";
import { criteriaModule } from "./criteria/module";
import { documentsModule } from "./documents/module";
import { dossiersModule } from "./dossiers/module";
import { entitiesModule } from "./entities/module";
import { filesModule } from "./files/module";
import { identityModule } from "./identity/module";
import { notificationsModule } from "./notifications/module";
import { orgModule } from "./org/module";
import type { Consumer } from "./platform/consumer-context";
import type { EventType } from "./platform/events";
import { resultsModule } from "./results/module";
import { roundsModule } from "./rounds/module";
import { scoringModule } from "./scoring/module";
import { systemModule } from "./system/module";
import { mergeTables } from "./shared/tables";

/**
 * The modules of the core, by the name callers see them under (`core.results.*`). Only a new module is added here; a new
 * feature declares its use cases, consumers and jobs in its own module's `module.ts`.
 */
export const MODULES = {
  identity: identityModule,
  org: orgModule,
  notifications: notificationsModule,
  audit: auditModule,
  files: filesModule,
  criteria: criteriaModule,
  rounds: roundsModule,
  entities: entitiesModule,
  dossiers: dossiersModule,
  councils: councilsModule,
  scoring: scoringModule,
  system: systemModule,
  results: resultsModule,
  documents: documentsModule,
};

const manifests = Object.values(MODULES);
const tablesOf = <K extends "consumers" | "jobs">(key: K) => manifests.map((m) => (key in m ? (m as Record<K, object>)[key] : {}));

type Of<K extends string> = { [M in keyof typeof MODULES]: (typeof MODULES)[M] extends Record<K, infer T> ? T : never }[keyof typeof MODULES];
type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never;
type Flat<T> = { [K in keyof T]: T[K] };

/** Every outbox consumer (ADR 0001), by queue name; the relay enqueues one job per (event, subscribed consumer). */
export const CONSUMERS = mergeTables("consumer", tablesOf("consumers")) as Flat<UnionToIntersection<Of<"consumers">>>;
export type ConsumerName = keyof typeof CONSUMERS;
export const CONSUMER_NAMES = Object.keys(CONSUMERS) as ConsumerName[];

export const consumersFor = (type: EventType): ConsumerName[] =>
  CONSUMER_NAMES.filter((name) => ((CONSUMERS[name] as Consumer).events as readonly EventType[]).includes(type));

/** Every recurring job, by queue name. */
export const JOBS = mergeTables("job", tablesOf("jobs")) as Flat<UnionToIntersection<Of<"jobs">>>;
export type JobName = keyof typeof JOBS;
export const JOB_NAMES = Object.keys(JOBS) as JobName[];
