import type { FileStatus } from "../files/model";
import type { DataScope } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import { DomainError } from "../shared/errors";
import type { EntityKind } from "./model";

/**
 * Loại giấy tờ pháp lý, from configuration (`entity.legal_document_type`): which Loại tổ chức must hold
 * one is data, not code, because the list is still to be confirmed by the chủ đầu tư.
 */
export interface LegalDocumentType {
  code: string;
  name: string;
  requiredFor: EntityKind[];
}

/**
 * One giấy tờ pháp lý of a Chủ thể. Never changed or deleted: replacing it adds a new one and stamps this
 * one with `replacedBy`, so the history stays (story 8).
 */
export interface LegalDocument {
  id: string;
  entityId: string;
  typeCode: string;
  documentNumber: string | null;
  /** Ngày cấp, YYYY-MM-DD. */
  issuedOn: string;
  /** The last VN calendar day it is valid, YYYY-MM-DD; null when it does not expire. */
  validUntil: string | null;
  fileId: string;
  addedBy: string;
  addedAt: Date;
  replacedBy: string | null;
  replacedAt: Date | null;
}

/** A giấy tờ with the state of its file, which only counts once the scan found it clean. */
export interface LegalDocumentRecord extends LegalDocument {
  file: { fileName: string; status: FileStatus };
}

export interface LegalDocumentRepo {
  types(): Promise<LegalDocumentType[]>;
  /** False, inserting nothing, when the file already backs another giấy tờ. */
  insert(d: LegalDocument): Promise<boolean>;
  /** Stamps a current giấy tờ as replaced by a newer one; the caller holds the Chủ thể's lock. */
  markReplaced(id: string, replacedBy: string, at: Date): Promise<void>;
  /** Every giấy tờ of the Chủ thể, current and replaced, when the Chủ thể is within the scope (#14). */
  list(scope: DataScope, entityId: string): Promise<LegalDocumentRecord[]>;
}

/**
 * Where one Loại giấy tờ stands for a Chủ thể today: `valid` (a current giấy tờ, scanned clean, not
 * expired), else `expired`, `scanning` or `blocked` after what its current giấy tờ are, else `missing`.
 */
export type RequirementState = "valid" | "expired" | "scanning" | "blocked" | "missing";

export interface Requirement {
  typeCode: string;
  name: string;
  required: boolean;
  state: RequirementState;
}

export interface LegalStanding {
  /** Đã xác thực: every required Loại giấy tờ is `valid` now. Computed, never stored. */
  verified: boolean;
  requirements: Requirement[];
}

export const isExpired = (d: Pick<LegalDocument, "validUntil">, now: Date) => d.validUntil !== null && vnDateOf(now) > d.validUntil;

const RANK: RequirementState[] = ["valid", "expired", "scanning", "blocked", "missing"];

function stateOf(d: LegalDocumentRecord, now: Date): RequirementState {
  if (d.file.status === "blocked") return "blocked";
  if (d.file.status !== "clean") return "scanning";
  return isExpired(d, now) ? "expired" : "valid";
}

/**
 * Đã xác thực and the state of each Loại giấy tờ (stories 6, 7), from the data at `now`: a giấy tờ that
 * expires overnight takes the Chủ thể out of Đã xác thực with no write at all.
 */
export function legalStanding(kind: EntityKind, types: LegalDocumentType[], documents: LegalDocumentRecord[], now: Date): LegalStanding {
  const current = documents.filter((d) => d.replacedBy === null);
  const requirements = types.map((type): Requirement => {
    const states = current.filter((d) => d.typeCode === type.code).map((d) => stateOf(d, now));
    const state = RANK.find((s) => states.includes(s)) ?? "missing";
    return { typeCode: type.code, name: type.name, required: type.requiredFor.includes(kind), state };
  });
  return { verified: requirements.every((r) => !r.required || r.state === "valid"), requirements };
}

export const legalDocumentNotFound = () => new DomainError("not_found", "Không tìm thấy giấy tờ");
