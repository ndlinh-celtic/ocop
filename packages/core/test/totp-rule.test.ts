import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "../src/identity/roles";
import { mustUseTotp } from "../src/identity/session";
import type { RoleAssignment } from "../src/identity/model";

const NOW = new Date("2026-10-20T03:00:00Z");
const holding = (role: Role, validTo: Date | null = null): RoleAssignment => ({
  id: `a-${role}`,
  userId: "u",
  role,
  scopeType: "system",
  scopeId: null,
  validFrom: new Date("2026-01-01T00:00:00Z"),
  validTo,
  grantedBy: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

// Written out from ADR 0003 and the Q5 answer, not derived from TOTP_OPTIONAL_ROLES.
const EXPECTED: Record<Role, boolean> = {
  entity_owner: false,
  ward_officer: false,
  province_officer: true,
  council_chair: true,
  council_secretary: true,
  council_member: true,
  advisory_member: true,
  admin: true,
};

describe("L20 DC-09 ADR 0003 which Vai trò must use TOTP", () => {
  it.each(ROLES.map((r) => [r]))("%s, with the deployment flag on", (role: Role) => {
    expect(mustUseTotp([holding(role)], NOW, true)).toBe(EXPECTED[role]);
  });

  it.each(ROLES.map((r) => [r]))("%s, with the deployment flag off, never", (role: Role) => {
    expect(mustUseTotp([holding(role)], NOW, false)).toBe(false);
  });

  it("one strict Phân vai among optional ones is enough", () => {
    expect(mustUseTotp([holding("ward_officer"), holding("council_member")], NOW, true)).toBe(true);
  });

  it("a strict Phân vai that has ended no longer counts", () => {
    expect(mustUseTotp([holding("ward_officer"), holding("admin", new Date("2026-06-01T00:00:00Z"))], NOW, true)).toBe(false);
  });
});
