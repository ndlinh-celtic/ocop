import type { RoleAssignment, Session, User } from "./model";
import type { Role } from "./roles";

export interface UserRepo {
  insert(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  /** Case-insensitive. */
  findByEmail(email: string): Promise<User | null>;
  update(id: string, patch: Partial<Omit<User, "id" | "createdAt">>): Promise<void>;
  list(): Promise<User[]>;
}

export interface RoleAssignmentRepo {
  insert(a: RoleAssignment): Promise<void>;
  findById(id: string): Promise<RoleAssignment | null>;
  listForUser(userId: string): Promise<RoleAssignment[]>;
  existsActiveWithRole(role: Role, at: Date): Promise<boolean>;
  /** Closes the validity window; Phân vai rows are never deleted. */
  end(id: string, validTo: Date): Promise<void>;
}

export interface SessionRepo {
  insert(s: Session): Promise<void>;
  findByTokenHash(hash: string): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
  update(id: string, patch: Partial<Pick<Session, "stage" | "authenticatedAt" | "authMethod" | "lastSeenAt" | "activeAssignmentId">>): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
  revokeAllForUserExcept(userId: string, keepSessionId: string, at: Date): Promise<void>;
}
