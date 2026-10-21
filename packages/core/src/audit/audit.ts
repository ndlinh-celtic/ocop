import type { AnonymousActor, SystemActor, UserActor } from "../shared/context";

/** The part of an actor an audit row needs; lets a use case audit before it has a full UserActor. */
export type AuditActor = Pick<UserActor, "kind" | "userId" | "activeRole" | "onBehalfOf" | "ctx"> | AnonymousActor | SystemActor;

/** One append-only audit row (L21). `before`/`after` hold the changed values, never secrets. */
export interface AuditEntry {
  id: string;
  occurredAt: Date;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown>;
  requestId: string | null;
  ip: string | null;
}

export interface AuditFilter {
  action?: string[];
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>;
  search(filter: AuditFilter): Promise<AuditEntry[]>;
}

export type AuditInput = Pick<AuditEntry, "action"> & Partial<Omit<AuditEntry, "id" | "occurredAt" | "actorUserId" | "actorRole" | "requestId" | "ip">>;

/**
 * Fills who/when/where from the actor so call sites only say what happened. Under Nhập hộ the actor is
 * the Cán bộ xã and `metadata.onBehalfOf` names the Chủ thể (story 73).
 */
export function auditEntry(actor: AuditActor, id: string, at: Date, input: AuditInput): AuditEntry {
  const onBehalfOf = actor.kind === "user" ? actor.onBehalfOf : undefined;
  return {
    id,
    occurredAt: at,
    actorUserId: actor.kind === "user" ? actor.userId : null,
    actorRole: actor.kind === "user" ? actor.activeRole : actor.kind === "system" ? `system:${actor.name}` : null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: onBehalfOf === undefined ? (input.metadata ?? {}) : { ...input.metadata, onBehalfOf },
    requestId: actor.ctx.requestId,
    ip: actor.ctx.ip ?? null,
  };
}
