import type { DataScope } from "../identity/scope";
import { DomainError } from "../shared/errors";

/** Loại tổ chức of a Chủ thể. */
export const ENTITY_KINDS = ["enterprise", "cooperative", "household"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  enterprise: "Doanh nghiệp",
  cooperative: "Hợp tác xã",
  household: "Hộ sản xuất",
};

/**
 * Chủ thể (GLOSSARY.md). A doanh nghiệp or hợp tác xã is identified by its mã số thuế, kept in clear; a hộ
 * sản xuất by the chủ hộ's số định danh cá nhân, personal data kept sealed with its last four digits for
 * masked display. `identifierFingerprint` (a keyed hash of the normalised identifier) makes either unique.
 */
export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  identifierFingerprint: string;
  taxCode: string | null;
  personalIdSealed: string | null;
  personalIdLast4: string | null;
  address: string;
  representativeName: string;
  phone: string;
  /** Xã/phường đăng ký. */
  wardId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Every read takes the reader's DataScope and filters in SQL (#14): there is deliberately no read without
 * one. Out-of-scope rows come back as absent.
 */
export interface EntityRepo {
  /** False, inserting nothing, when another Chủ thể already has this identifier. */
  insert(e: Entity): Promise<boolean>;
  findById(scope: DataScope, id: string): Promise<Entity | null>;
  list(scope: DataScope): Promise<Entity[]>;
}

export const entityNotFound = () => new DomainError("not_found", "Không tìm thấy chủ thể");

/** Mã số thuế or số định danh as stored and compared: no blanks, dots or dashes, upper case. */
export const normalizeIdentifier = (raw: string) => raw.replace(/[\s.-]/g, "").toUpperCase();

/** Mã số thuế: 10 digits, or 13 for a branch (10 + 3). Số định danh cá nhân: 12 digits. */
const TAX_CODE = /^[0-9]{10}([0-9]{3})?$/;
const PERSONAL_ID = /^[0-9]{12}$/;

/** Checks a normalised identifier against what the Loại tổ chức uses. */
export function assertIdentifierShape(kind: EntityKind, identifier: string) {
  if (kind === "household") {
    if (!PERSONAL_ID.test(identifier)) throw new DomainError("identifier_invalid", "Số định danh cá nhân của chủ hộ gồm 12 chữ số");
    return;
  }
  if (!TAX_CODE.test(identifier)) throw new DomainError("identifier_invalid", "Mã số thuế gồm 10 hoặc 13 chữ số");
}

/** How a số định danh cá nhân appears to anyone but its owner (story 13): only the last four digits. */
export const maskPersonalId = (last4: string) => `••••••••${last4}`;
