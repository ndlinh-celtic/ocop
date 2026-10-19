import type { Mailer } from "../platform/mail";
import type { Clock, IdGen, PasswordHasher, SecretBox, TotpService } from "./ports";
import type { UnitOfWork } from "./uow";

/** Deployment settings the rules depend on (ADR 0003). */
export interface CoreSettings {
  totpRequired: boolean;
  /** Public base URL, used to build links in emails. */
  appBaseUrl: string;
}

export interface CoreDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGen;
  hasher: PasswordHasher;
  totp: TotpService;
  secretBox: SecretBox;
  mailer: Mailer;
  settings: CoreSettings;
}
