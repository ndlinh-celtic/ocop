import type { Consumer } from "../platform/consumer-context";
import type { ScheduledJob } from "../platform/jobs";
import type { CoreDeps } from "./deps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a use case takes whatever its own input is
export type UseCaseFactory = (deps: CoreDeps) => (...args: any[]) => unknown;

/**
 * What one module of the core contributes, declared in its `module.ts`: the use cases callers see under `core.<module>`,
 * the outbox consumers (ADR 0001) and the recurring jobs. The registry merges every module's; a new feature adds its
 * lines here, in its own module, and touches no shared list. Its permissions are the module's `permissions.ts`.
 */
export interface ModuleManifest {
  useCases?: Record<string, UseCaseFactory>;
  consumers?: Record<string, Consumer>;
  jobs?: Record<string, ScheduledJob>;
}

export const defineModule = <const M extends ModuleManifest>(manifest: M): M => manifest;

/** The use cases of a module, each bound to the core's dependencies. */
export type BoundUseCases<U> = { [K in keyof U]: U[K] extends UseCaseFactory ? ReturnType<U[K]> : never };

export function bindUseCases<U extends Record<string, UseCaseFactory>>(deps: CoreDeps, useCases: U): BoundUseCases<U> {
  return Object.fromEntries(Object.entries(useCases).map(([name, factory]) => [name, factory(deps)])) as BoundUseCases<U>;
}
