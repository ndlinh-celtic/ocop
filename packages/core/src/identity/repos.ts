import type { RoleAssignment, Session, User } from "./model";
import type { Role } from "./roles";

export interface UserRepo {
  insert(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  /** Case-insensitive. */
  findByEmail(email: string): Promise<User | null>;
}

export interface RoleAssignmentRepo {
  insert(a: RoleAssignment): Promise<void>;
  findById(id: string): Promise<RoleAssignment | null>;
  listForUser(userId: string): Promise<RoleAssignment[]>;
  existsActiveWithRole(role: Role, at: Date): Promise<boolean>;
}

export interface SessionRepo {
  insert(s: Session): Promise<void>;
  findByTokenHash(hash: string): Promise<Session | null>;
  revoke(id: string, at: Date): Promise<void>;
}
