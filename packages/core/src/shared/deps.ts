import type { Clock, IdGen, PasswordHasher } from "./ports";
import type { UnitOfWork } from "./uow";

export interface CoreDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGen;
  hasher: PasswordHasher;
}
