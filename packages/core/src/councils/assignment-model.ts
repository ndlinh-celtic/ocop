/**
 * Phân công (L09 HD-02, spec #49): one Người dùng on one hồ sơ, as thành viên chấm (`member`) or as
 * Thành viên Tổ tư vấn (`advisory`). A nháp (no `effectiveAt`) is the Thư ký's draft, free to change and
 * invisible to the person it names (story 41); Giao chấm gives it effect, once, and from then on that person
 * sees the hồ sơ. One current row per (hồ sơ, Người dùng) whatever the kind: the DB refuses a second one.
 */
export const ASSIGNMENT_KINDS = ["member", "advisory"] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export interface Assignment {
  id: string;
  dossierId: string;
  userId: string;
  kind: AssignmentKind;
  createdBy: string;
  createdAt: Date;
  /** Set by Giao chấm and never again; null while the Phân công is a nháp. */
  effectiveAt: Date | null;
  replacedAt: Date | null;
  replacedBy: string | null;
  replaceReason: string | null;
}

export interface AssignmentRepo {
  /** The current (not replaced) Phân công of a hồ sơ already loaded within scope, oldest first. */
  current(dossierId: string): Promise<Assignment[]>;
  insert(a: Assignment): Promise<void>;
  /** Deletes nháp rows by id; the DB refuses to delete one in force. */
  deleteDrafts(ids: readonly string[]): Promise<void>;
}
