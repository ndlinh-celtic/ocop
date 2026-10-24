import { auditEntry } from "../audit/audit";
import type { FileStatus } from "../files/model";
import { isAssignmentActive } from "../identity/model";
import { authorize } from "../identity/policy";
import type { Role } from "../identity/roles";
import type { RoundStatus } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { councilNotFound } from "./manage";
import type { Council } from "./model";

/** The Vai trò held on Phạm vi Hội đồng, in the order the member list shows them. */
export const COUNCIL_ROLES = ["council_chair", "council_secretary", "council_member", "advisory_member"] as const satisfies readonly Role[];
export type CouncilRole = (typeof COUNCIL_ROLES)[number];

/** One member of a Hội đồng: a Phân vai in force on its Phạm vi. */
export interface CouncilMember {
  assignmentId: string;
  userId: string;
  fullName: string;
  email: string;
  validFrom: Date;
  validTo: Date | null;
  /** Council Vai trò must use TOTP (unless the deployment opts out); S40 flags those who have not enrolled. */
  totpEnabled: boolean;
}

export interface CouncilDetail extends Council {
  decisionFile: { id: string; fileName: string; status: FileStatus } | null;
  /** The Tổ trưởng; `active` is false once their Phân vai Thành viên Tổ tư vấn has ended (a new one must be named). */
  leader: { userId: string; fullName: string; active: boolean } | null;
  /** Story 8: the members by Vai trò, from the Phân vai in force now. */
  members: Record<CouncilRole, CouncilMember[]>;
  /** The Đợt đánh giá assigned to this Hội đồng. */
  rounds: { id: string; name: string; year: number; status: RoundStatus }[];
}

/** The members of a Hội đồng by Vai trò: the Phân vai in force at `at` on its Phạm vi. */
export async function councilMembers(tx: Tx, councilId: string, at: Date): Promise<Record<CouncilRole, CouncilMember[]>> {
  // One query at a time: every repository of the transaction shares one connection.
  const members = {} as Record<CouncilRole, CouncilMember[]>;
  for (const role of COUNCIL_ROLES) {
    members[role] = [];
    for (const a of await tx.roleAssignments.listForScope(role, "council", councilId)) {
      if (!isAssignmentActive(a, at)) continue;
      const user = await tx.users.findById(a.userId);
      if (!user) continue;
      members[role].push({
        assignmentId: a.id,
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        validFrom: a.validFrom,
        validTo: a.validTo,
        totpEnabled: user.totpEnabledAt !== null,
      });
    }
  }
  return members;
}

/** L09 HD-01: every Hội đồng, newest first, for Cán bộ Sở (S40) and for Quản trị choosing a Phạm vi (S70). */
export function listCouncils(deps: CoreDeps) {
  return async (actor: Actor): Promise<Council[]> => {
    authorize(actor, "council.read");
    return deps.uow.run((tx) => tx.councils.list());
  };
}

/** L09 HD-01 story 8: one Hội đồng with its quyết định, Tổ trưởng, members by Vai trò and đợt. */
export function getCouncil(deps: CoreDeps) {
  return async (actor: Actor, input: { councilId: string }): Promise<CouncilDetail> => {
    authorize(actor, "council.read");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.councilId, councilNotFound);
      const council = await tx.councils.findById(input.councilId);
      if (!council) throw councilNotFound();
      const now = deps.clock.now();
      const members = await councilMembers(tx, council.id, now);
      const file = await tx.files.findById(council.decisionFileId);
      const leaderUser = council.leaderUserId ? await tx.users.findById(council.leaderUserId) : null;
      const rounds = (await tx.rounds.list()).filter((r) => r.councilId === council.id);
      // The member list names people: a personal data access (NĐ 13/2023).
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "personal_data.viewed",
          targetType: "council",
          targetId: council.id,
          metadata: { view: "council_members" },
        }),
      );
      return {
        ...council,
        decisionFile: file ? { id: file.id, fileName: file.fileName, status: file.status } : null,
        leader: leaderUser
          ? { userId: leaderUser.id, fullName: leaderUser.fullName, active: members.advisory_member.some((m) => m.userId === leaderUser.id) }
          : null,
        members,
        rounds: rounds.map((r) => ({ id: r.id, name: r.name, year: r.year, status: r.status })),
      };
    });
  };
}

/** A short-lived link to the quyết định thành lập of a Hội đồng. */
export function downloadCouncilDecision(deps: CoreDeps) {
  return async (actor: Actor, input: { councilId: string }): Promise<{ url: string; expiresAt: Date; fileName: string }> => {
    authorize(actor, "council.read");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.councilId, councilNotFound);
      const council = await tx.councils.findById(input.councilId);
      if (!council) throw councilNotFound();
      const file = await tx.files.findById(council.decisionFileId);
      if (!file || file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa sẵn sàng để tải xuống");
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "file.download_issued",
          targetType: "file",
          targetId: file.id,
          metadata: { councilId: council.id, document: "council_decision" },
        }),
      );
      return { url: get.url, expiresAt: get.expiresAt, fileName: file.fileName };
    });
  };
}
