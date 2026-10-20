import type { UserActor } from "../shared/context";

/**
 * Nhập hộ (L01, stories 72 to 75): the officer, still themselves, acting for one Chủ thể. Nothing is
 * checked here and nothing needs to be: the DataScope of the result (identity/scope.ts) covers only that
 * Chủ thể, and only while it is đăng ký ở xã of the officer's Vai trò đang dùng, so any other Chủ thể is
 * not found; and policy allows only the `*_on_behalf` actions, which only `ward_officer` holds. There is
 * no sign-in as the Chủ thể.
 */
export function onBehalfOf(actor: UserActor, entityId: string): UserActor {
  return { ...actor, onBehalfOf: entityId };
}
