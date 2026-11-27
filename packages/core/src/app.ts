import { handleEvent } from "./platform/consumers";
import { runJob } from "./platform/jobs";
import { CONSUMERS, JOBS, MODULES } from "./registry";
import type { CoreDeps } from "./shared/deps";
import { bindUseCases, type BoundUseCases } from "./shared/module";

type ModuleUseCases = { [M in keyof typeof MODULES]: BoundUseCases<(typeof MODULES)[M]["useCases"]> };

/**
 * The use cases of the core, bound to their dependencies: `core.<module>.<useCase>`, as each module's `module.ts`
 * declares them. UI and worker only call these.
 */
export function createCore(deps: CoreDeps) {
  const modules = Object.fromEntries(Object.entries(MODULES).map(([name, m]) => [name, bindUseCases(deps, m.useCases)])) as ModuleUseCases;
  return {
    ...modules,
    platform: {
      handleEvent: handleEvent(deps, CONSUMERS),
      runJob: runJob(deps, JOBS),
    },
  };
}

export type Core = ReturnType<typeof createCore>;
