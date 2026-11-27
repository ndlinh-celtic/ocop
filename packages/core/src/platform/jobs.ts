import type { SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";

/**
 * A recurring job, declared by the module that owns it: the worker schedules it on `cron` (Vietnam time) in its own
 * pg-boss queue named after it, and runs `run` bound to the core's dependencies, as a use case is.
 */
export interface ScheduledJob {
  cron: string;
  run(deps: CoreDeps): (system: SystemActor) => Promise<unknown>;
}

/** Runs one job by name; the worker calls this for every job of the registry. */
export function runJob<N extends string>(deps: CoreDeps, jobs: Record<N, ScheduledJob>) {
  const bound = new Map<string, (system: SystemActor) => Promise<unknown>>();
  for (const [name, job] of Object.entries<ScheduledJob>(jobs)) bound.set(name, job.run(deps));
  return async (system: SystemActor, input: { job: N }): Promise<void> => {
    const run = bound.get(input.job);
    if (!run) throw new DomainError("unknown_job", `No job ${input.job}`);
    await run(system);
  };
}
