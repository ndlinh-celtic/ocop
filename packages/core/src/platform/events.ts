import type { AssignmentKind } from "../councils/assignment-model";
import type { DraftChangeAction, DraftChangePayload } from "../criteria/draft-events";
import type { DossierState } from "../dossiers/model";
import type { ReminderPayload } from "../dossiers/reminder-model";
import type { DossierEventType } from "../dossiers/transitions";
import type { ExtendableDeadline, GradingMode } from "../rounds/model";

/** Domain events written to the outbox in the same transaction as the change (ADR 0001). */
export type DomainEventBody =
  | { type: "identity.user.created"; payload: { userId: string } }
  | { type: "identity.activation.requested"; payload: { userId: string } }
  | { type: "identity.role.granted"; payload: { assignmentId: string } }
  | { type: "identity.user.locked"; payload: { userId: string; until: string } }
  | { type: "identity.password_reset.requested"; payload: { userId: string } }
  | { type: "files.uploaded"; payload: { fileId: string } }
  | { type: "files.blocked"; payload: { fileId: string } }
  | { type: "criteria.version.imported"; payload: { versionId: string } }
  | { type: "criteria.version.published"; payload: { versionId: string } }
  | { type: "criteria.version.copied"; payload: { versionId: string; copiedFrom: string } }
  | { type: "criteria.version.deleted"; payload: { versionId: string } }
  | { type: DraftChangeAction; payload: DraftChangePayload }
  | { type: "round.created"; payload: { roundId: string } }
  | { type: "round.updated"; payload: { roundId: string } }
  | { type: "round.deleted"; payload: { roundId: string } }
  | { type: "round.opened"; payload: { roundId: string; criteriaVersionId: string; submissionDeadline: string } }
  | { type: "round.submission_closed"; payload: { roundId: string; submissionDeadline: string; closedAt: string } }
  | {
      type: "round.deadline_extended";
      payload: { roundId: string; extensionId: string; deadline: ExtendableDeadline; previousDeadline: string; newDeadline: string };
    }
  | { type: "round.grading_mode_changed"; payload: { roundId: string; from: GradingMode; to: GradingMode } }
  | { type: "round.aggregation_changed"; payload: { roundId: string } }
  | { type: "round.ended"; payload: { roundId: string } }
  | { type: "round.checklist_configured"; payload: { roundId: string } }
  | { type: "round.council_assigned"; payload: { roundId: string; fromCouncilId: string | null; toCouncilId: string } }
  | { type: "council.created" | "council.updated"; payload: { councilId: string } }
  | {
      // L09 HD-03 (#55): a Phân công changed after Giao chấm; `replacedUserId` is null for a bổ sung.
      type: "council.assignment.replaced" | "council.assignment.added";
      payload: { dossierId: string; entityId: string; kind: AssignmentKind; replacedUserId: string | null; newUserId: string };
    }
  | { type: "council.leader_changed"; payload: { councilId: string; fromUserId: string | null; toUserId: string } }
  | { type: "entity.registered" | "entity.created"; payload: { entityId: string; userId: string } }
  | { type: "entity.representative_email_changed"; payload: { entityId: string; userId: string } }
  | { type: "entity.updated"; payload: { entityId: string } }
  | { type: "entity.ward_changed"; payload: { entityId: string; fromWardId: string; toWardId: string } }
  | { type: "entity.legal_document.added" | "entity.legal_document.replaced"; payload: { entityId: string; documentId: string; replacesId: string | null } }
  | { type: "system.setting_changed"; payload: { key: string } }
  | { type: "dossier.reminder_due"; payload: ReminderPayload }
  | {
      type: DossierEventType;
      /** `actorUserId`: who made the move; absent on events recorded before it was added. */
      payload: { dossierId: string; entityId: string; from: DossierState | null; to: DossierState; actorUserId?: string };
    };

export type EventType = DomainEventBody["type"];

export type DomainEvent = DomainEventBody & { id: string; occurredAt: Date };

export interface Outbox {
  add(event: DomainEvent): Promise<void>;
  get(id: string): Promise<DomainEvent | null>;
}

/** Consumers are idempotent per event: a redelivered event is skipped. */
export interface ProcessedEvents {
  /** True the first time (event, consumer) is seen in a committed transaction. */
  markIfNew(eventId: string, consumer: string, at: Date): Promise<boolean>;
}
