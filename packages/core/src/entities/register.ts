import { auditEntry } from "../audit/audit";
import type { RoleAssignment } from "../identity/model";
import { emit } from "../platform/emit";
import { consumeRateLimit } from "../platform/throttle";
import type { AnonymousActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { isUuid } from "../shared/ids";
import { assertIdentifierShape, ENTITY_KINDS, normalizeIdentifier, type Entity, type EntityKind } from "./model";

export interface RegisterEntityInput {
  kind: EntityKind;
  /** Tên tổ chức, or the chủ hộ's name for a hộ sản xuất. */
  name: string;
  /** Mã số thuế, or số định danh cá nhân of the chủ hộ for a hộ sản xuất. */
  identifier: string;
  address: string;
  representativeName: string;
  phone: string;
  email: string;
  wardId: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9]{9,12}$/;

/**
 * One message for a taken identifier and a taken email (story 4): it must not tell a visitor which one
 * matched, nor anything about the existing account.
 */
const registrationConflict = () =>
  new DomainError(
    "registration_conflict",
    "Không thể đăng ký với mã số thuế, số định danh hoặc email này vì đã được dùng. Nếu cơ sở của bạn đã có tài khoản, hãy liên hệ Cán bộ xã để được hỗ trợ khôi phục.",
  );

function required(value: string, code: string, message: string) {
  const v = value.trim();
  if (!v) throw new DomainError(code, message);
  return v;
}

function parse(input: RegisterEntityInput) {
  if (!ENTITY_KINDS.includes(input.kind)) throw new DomainError("kind_invalid", "Chọn loại tổ chức");
  const identifier = normalizeIdentifier(input.identifier);
  assertIdentifierShape(input.kind, identifier);
  const email = input.email.trim();
  if (!EMAIL.test(email)) throw new DomainError("email_invalid", "Email không hợp lệ");
  const phone = input.phone.replace(/[\s.-]/g, "");
  if (!PHONE.test(phone)) throw new DomainError("phone_invalid", "Số điện thoại không hợp lệ");
  return {
    kind: input.kind,
    identifier,
    email,
    phone,
    name: required(input.name, "name_required", "Nhập tên tổ chức hoặc họ tên chủ hộ"),
    address: required(input.address, "address_required", "Nhập địa chỉ"),
    representativeName: required(input.representativeName, "representative_required", "Nhập họ tên người đại diện"),
  };
}

/**
 * L01 CT-01: a visitor registers a Chủ thể. One transaction creates the Chủ thể, its Người dùng đại diện
 * pending activation, and the Phân vai entity_owner scoped to that Chủ thể; the activation email follows
 * through the step 1 consumer. Attempts are rate limited per client address.
 */
export function registerEntity(deps: CoreDeps) {
  return async (anonymous: AnonymousActor, input: RegisterEntityInput): Promise<void> => {
    await consumeRateLimit(deps, "entity.register", anonymous.ctx, deps.settings.registrationRateLimit);
    const form = parse(input);
    await deps.uow.run(async (tx) => {
      if (!isUuid(input.wardId) || !(await tx.wards.findById(input.wardId))) throw new DomainError("ward_required", "Chọn xã/phường");
      if (await tx.users.findByEmail(form.email)) throw registrationConflict();

      const now = deps.clock.now();
      const household = form.kind === "household";
      const entity: Entity = {
        id: deps.ids.next(),
        kind: form.kind,
        name: form.name,
        identifierFingerprint: deps.secretBox.fingerprint(`entity:${form.identifier}`),
        taxCode: household ? null : form.identifier,
        personalIdSealed: household ? deps.secretBox.seal(form.identifier) : null,
        personalIdLast4: household ? form.identifier.slice(-4) : null,
        address: form.address,
        representativeName: form.representativeName,
        phone: form.phone,
        wardId: input.wardId,
        createdAt: now,
        updatedAt: now,
      };
      if (!(await tx.entities.insert(entity))) throw registrationConflict();

      const userId = deps.ids.next();
      await tx.users.insert({
        id: userId,
        email: form.email,
        fullName: form.representativeName,
        passwordHash: null,
        status: "pending_activation",
        createdAt: now,
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpPendingSecretEnc: null,
        failedCount: 0,
        failedWindowStart: null,
        lockedUntil: null,
      });
      const assignment: RoleAssignment = {
        id: deps.ids.next(),
        userId,
        role: "entity_owner",
        scopeType: "entity",
        scopeId: entity.id,
        validFrom: now,
        validTo: null,
        grantedBy: null,
        createdAt: now,
      };
      await tx.roleAssignments.insert(assignment);

      // The registrant is the new Người dùng, though they hold no session yet.
      const actor = { kind: "user" as const, userId, activeRole: null, ctx: anonymous.ctx };
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "entity.registered",
          targetType: "entity",
          targetId: entity.id,
          after: { kind: entity.kind, name: entity.name, wardId: entity.wardId },
          metadata: { userId, assignmentId: assignment.id },
        }),
      );
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "identity.user.created",
          targetType: "user",
          targetId: userId,
          after: { email: form.email, fullName: form.representativeName },
          metadata: { entityId: entity.id },
        }),
      );
      await emit(deps, tx, { type: "entity.registered", payload: { entityId: entity.id, userId } });
      await emit(deps, tx, { type: "identity.user.created", payload: { userId } });
    });
  };
}
