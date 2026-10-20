import type { CoreDeps } from "../shared/deps";

/** The ward catalogue is public reference data: no Vai trò needed to read it. */
export function listWards(deps: CoreDeps) {
  return () => deps.uow.run((tx) => tx.wards.list());
}
