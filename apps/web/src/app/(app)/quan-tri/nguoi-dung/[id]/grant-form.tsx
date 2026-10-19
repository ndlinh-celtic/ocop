"use client";

import { ROLE_LABEL, ROLES, SCOPE_OF_ROLE, type Role } from "@ocop/core";
import { useActionState, useState } from "react";
import { grantRoleAction, type GrantState } from "./actions";

/** Chủ thể and hội đồng scopes have no catalogue until steps 3 and 4. */
const GRANTABLE = ROLES.filter((r) => ["ward", "province", "system"].includes(SCOPE_OF_ROLE[r]));

export function GrantRoleForm({ userId, wards }: { userId: string; wards: { id: string; code: string; name: string }[] }) {
  const [role, setRole] = useState<Role>("ward_officer");
  const [state, action, pending] = useActionState<GrantState, FormData>(grantRoleAction.bind(null, userId), {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Vai trò
        <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border px-3 py-2">
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
          <select name="scopeId" required className="rounded-lg border px-3 py-2">
            <option value="">Chọn xã/phường</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Hiệu lực từ (bỏ trống: ngay)
        <input name="validFrom" type="date" className="rounded-lg border px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
        Gán vai trò
      </button>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-green-700">Đã gán vai trò</p>}
    </form>
  );
}
