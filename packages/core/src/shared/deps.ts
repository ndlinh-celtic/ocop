import type { Mailer } from "../platform/mail";
import type { Clock, IdGen, PasswordHasher, SecretBox, TotpService } from "./ports";
import type { UnitOfWork } from "./uow";

/** Deployment settings the rules depend on (ADR 0003). */
export interface CoreSettings {
  totpRequired: boolean;
  /** Public base URL, used to build links in emails. */
  appBaseUrl: string;
  lockout: { maxFailures: number; windowMs: number; lockMs: number };
  session: {
    /** Idle limit for anyone holding a Vai trò outside TOTP_OPTIONAL_ROLES. */
    idleStrictMs: number;
    /** Idle limit for Chủ thể and Cán bộ xã only. */
    idleRelaxedMs: number;
    maxLifetimeMs: number;
  };
  passwordResetTtlMs: number;
}

/** Spec #1 defaults; every value can be overridden by deployment configuration. */
export const DEFAULT_SETTINGS: Omit<CoreSettings, "totpRequired" | "appBaseUrl"> = {
  lockout: { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  session: { idleStrictMs: 30 * 60_000, idleRelaxedMs: 8 * 3_600_000, maxLifetimeMs: 12 * 3_600_000 },
  passwordResetTtlMs: 3_600_000,
};

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
