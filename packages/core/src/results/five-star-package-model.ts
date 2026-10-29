/*
 * Gói đề nghị 5 sao (L17 SO-04, #89, spec #79 "Đề xuất 5 sao và Gói đề nghị 5 sao"): one export the Cán bộ Sở asked for,
 * built by a job into a ZIP under `exports/` in object storage, downloadable until `expiresAt`. After that the job
 * `results.five-star-packages-expire` deletes the object and sets `removedAt`; a bucket lifecycle rule, where the
 * provider has one, is only a backup. Exporting never changes a hồ sơ; it may be repeated at will (story 52).
 */

export const FIVE_STAR_PACKAGE_STATES = ["pending", "ready", "failed"] as const;
export type FiveStarPackageState = (typeof FIVE_STAR_PACKAGE_STATES)[number];

export interface FiveStarPackage {
  id: string;
  requestedBy: string;
  requestedAt: Date;
  /** The hồ sơ picked, in the order of the package. */
  dossierIds: string[];
  state: FiveStarPackageState;
  /** Set once `ready`. */
  storageKey: string | null;
  size: number | null;
  /** Until when the ZIP may be downloaded; set once `ready`. */
  expiresAt: Date | null;
  /** When the job finished, ready or failed. */
  completedAt: Date | null;
  /** Why the job failed, for the Sở to read. */
  failure: string | null;
  /** When the expiry job deleted the ZIP of a `ready` package past `expiresAt`. */
  removedAt: Date | null;
}

export interface FiveStarPackageRepo {
  insert(p: FiveStarPackage): Promise<void>;
  findById(id: string): Promise<FiveStarPackage | null>;
  /** Newest first. */
  list(limit: number): Promise<FiveStarPackage[]>;
  /** Moves a `pending` package to `ready`; false when it was not pending. */
  markReady(id: string, r: { storageKey: string; size: number; expiresAt: Date; completedAt: Date }): Promise<boolean>;
  /** Moves a `pending` package to `failed`; false when it was not pending. */
  markFailed(id: string, f: { failure: string; completedAt: Date }): Promise<boolean>;
  /** `ready` packages with `expiresAt` at or before `now` whose ZIP is not removed yet, oldest hạn tải first. */
  dueForRemoval(now: Date, limit: number): Promise<FiveStarPackage[]>;
  /** Records the ZIP of a `ready` package removed; false when it already was. */
  markRemoved(id: string, removedAt: Date): Promise<boolean>;
}
