"use client";

import { ROLE_LABEL, ROLES, SCOPE_OF_ROLE, type Role } from "@ocop/core";
import { useActionState, useState } from "react";
import { grantRoleAction, type GrantState } from "./actions";

/** Chủ thể get their Vai trò by registering; every other Vai trò is granted here. */
const GRANTABLE = ROLES.filter((r) => SCOPE_OF_ROLE[r] !== "entity");
const DEFAULT_ROLE: Role = "ward_officer";

export function GrantRoleForm({
  userId,
  wards,
  councils,
}: {
  userId: string;
  wards: { id: string; code: string; name: string }[];
  /** L09 HD-01 story 6: a Phạm vi Hội đồng is chosen by the Hội đồng's tên. */
  councils: { id: string; name: string; decisionNumber: string }[];
}) {
  const [role, setRole] = useState<Role>(DEFAULT_ROLE);
  const [state, action, pending] = useActionState<GrantState, FormData>(async (prev, form) => {
    const next = await grantRoleAction(userId, prev, form);
    // React resets the form once the action ends; the Vai trò, and so which Phạm vi is asked for, follows.
    setRole(DEFAULT_ROLE);
    return next;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Vai trò
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-md border border-line-strong bg-surface px-3 py-2">
          {GRANTABLE.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      {SCOPE_OF_ROLE[role] === "ward" && (
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Xã/phường
          <select name="scopeId" required className="rounded-md border border-line-strong bg-surface px-3 py-2">
            <option value="">Chọn xã/phường</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
      )}
      {SCOPE_OF_ROLE[role] === "council" && (
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Hội đồng
          <select name="scopeId" required className="rounded-md border border-line-strong bg-surface px-3 py-2">
            <option value="">{councils.length === 0 ? "Chưa có hội đồng nào được Sở ghi nhận" : "Chọn hội đồng"}</option>
            {councils.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (QĐ {c.decisionNumber})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Hiệu lực từ (bỏ trống: ngay)
        <input name="validFrom" type="date" className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Hiệu lực đến (bỏ trống: không thời hạn)
        <input name="validTo" type="date" className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand text-brand-ink px-4 py-2 font-semibold disabled:opacity-60">
        Gán vai trò
      </button>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-brand">Đã gán vai trò</p>}
    </form>
  );
}
