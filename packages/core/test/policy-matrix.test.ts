import { describe, expect, it } from "vitest";
import { DOSSIER_STATE_LABEL } from "../src/dossiers/model";
import { TRANSITIONS } from "../src/dossiers/transitions";
import { ROLE_ACTIONS, SELF_ACTIONS } from "../src/identity/policy";
import { ROLE_LABEL, ROLES, type Role } from "../src/identity/roles";

/**
 * The whole ma trận phân quyền as one reviewable file: each module declares its own permissions, so a PR that changes one
 * shows its effect here. Regenerate with `pnpm --filter @ocop/core test -u` and review the diff.
 */
function policyMatrix(): string {
  const roles = (list: readonly Role[]) => ROLES.map((r) => (list.includes(r) ? "✓" : "")).join(" | ");
  const header = `| Action | ${ROLES.map((r) => ROLE_LABEL[r]).join(" | ")} |\n| --- |${" :-: |".repeat(ROLES.length)}`;
  const actions = Object.entries(ROLE_ACTIONS as Record<string, readonly Role[]>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([action, list]) => `| \`${action}\` | ${roles(list)} |`);
  const flags = (r: (typeof TRANSITIONS)[number]) => [r.onBehalf && "Nhập hộ", r.lookup && "lookup", r.checkOnly && "checkOnly"].filter(Boolean).join(", ");
  const rows = [...TRANSITIONS]
    .sort((a, b) => a.action.localeCompare(b.action) || a.from.localeCompare(b.from))
    .map(
      (r) =>
        `| \`${r.action}\` | ${DOSSIER_STATE_LABEL[r.from]} | ${DOSSIER_STATE_LABEL[r.to]} | ${r.roles.map((x) => ROLE_LABEL[x]).join(", ")} | ${flags(r)} |`,
    );
  return [
    "<!-- Sinh bởi packages/core/test/policy-matrix.test.ts; đừng sửa tay. Cập nhật: pnpm --filter @ocop/core test -u -->",
    "",
    "# Ma trận phân quyền",
    "",
    "## Action không gắn tài nguyên",
    "",
    "Khai báo ở `permissions.ts` của từng module, gộp ở `identity/policy.ts`. Phạm vi (DataScope) quyết định thêm là những bản ghi nào.",
    "",
    header,
    ...actions,
    "",
    "Mọi Người dùng đã đăng nhập, với dữ liệu của chính mình: " +
      [...SELF_ACTIONS]
        .sort()
        .map((a) => `\`${a}\``)
        .join(", ") +
      ".",
    "",
    "## Action trên một hồ sơ",
    "",
    "Bảng chuyển trạng thái `dossiers/transitions.ts`; Phạm vi của người dùng phải bao hồ sơ.",
    "",
    "| Action | Từ | Đến | Vai trò | Ghi chú |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

describe("ma trận phân quyền", () => {
  it("matches docs/policy-matrix.md", async () => {
    await expect(policyMatrix()).toMatchFileSnapshot("../../../docs/policy-matrix.md");
  });

  it("keeps the Tổ tư vấn off chốt điểm and quyết định công nhận", () => {
    for (const [action, list] of Object.entries(ROLE_ACTIONS as Record<string, readonly Role[]>)) {
      if (/^scoring\.(finalize|unlock)|^results\.decision/.test(action)) expect(list, action).not.toContain("advisory_member");
    }
  });
});
