// The public interface of the shared module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export type { Clock, IdGen, PasswordHasher, SecretBox, TotpCheck, TotpService } from "./ports";
export { DEFAULT_SETTINGS, type CoreDeps, type CoreSettings } from "./deps";
export type { Repos, Tx, UnitOfWork } from "./uow";
export { anonymousActor, systemActor, type Actor, type AnonymousActor, type RequestContext, type SystemActor, type UserActor } from "./context";
export { DomainError } from "./errors";
export { defineModule, type ModuleManifest } from "./module";
