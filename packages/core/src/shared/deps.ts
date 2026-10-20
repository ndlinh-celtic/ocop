import type { FileStore } from "../files/file-store";
import type { FileInspector } from "../files/inspection";
import { DEFAULT_ALLOWED_TYPES } from "../files/model";
import type { Mailer } from "../platform/mail";
import type { Clock, IdGen, PasswordHasher, SecretBox, TotpService } from "./ports";
import type { RoundActivity } from "../rounds/activity";
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
  /** Public Chủ thể registration attempts allowed per client address and window. */
  registrationRateLimit: { max: number; windowMs: number };
  files: {
    maxBytes: number;
    allowedTypes: Record<string, string[]>;
    multipartThresholdBytes: number;
    partSizeBytes: number;
    uploadUrlTtlSec: number;
    downloadUrlTtlSec: number;
  };
}

/** Spec #1 defaults; every value can be overridden by deployment configuration. */
export const DEFAULT_SETTINGS: Omit<CoreSettings, "totpRequired" | "appBaseUrl"> = {
  lockout: { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  session: { idleStrictMs: 30 * 60_000, idleRelaxedMs: 8 * 3_600_000, maxLifetimeMs: 12 * 3_600_000 },
  passwordResetTtlMs: 3_600_000,
  registrationRateLimit: { max: 5, windowMs: 3_600_000 },
  files: {
    maxBytes: 100 * 1024 * 1024,
    allowedTypes: DEFAULT_ALLOWED_TYPES,
    multipartThresholdBytes: 16 * 1024 * 1024,
    partSizeBytes: 8 * 1024 * 1024,
    uploadUrlTtlSec: 15 * 60,
    downloadUrlTtlSec: 5 * 60,
  },
};

export interface CoreDeps {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGen;
  hasher: PasswordHasher;
  totp: TotpService;
  secretBox: SecretBox;
  mailer: Mailer;
  files: FileStore;
  /** The bucket that receives daily audit anchors (ADR 0002); ideally with Object Lock. */
  anchorStore: FileStore;
  inspector: FileInspector;
  settings: CoreSettings;
  /** Phiếu chấm and hồ sơ of a Đợt đánh giá, as the rounds module sees them (#27). */
  roundActivity: RoundActivity;
}
