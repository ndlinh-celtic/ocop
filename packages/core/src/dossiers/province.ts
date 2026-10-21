import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { lockDossier } from "./edit";
import { transition } from "./transition";

/**
 * L08 SO-02 (stories 12, 15, 16): the Cán bộ Sở Tiếp nhận tại tỉnh a hồ sơ Đã chuyển tỉnh, once per lượt
 * gửi tỉnh. The state stays; the hồ sơ records when and by whom, and the first time ever, from which the
 * Hội đồng of its đợt sees it. Refused while the đợt has no Hội đồng, which must be gán first.
 */
export function receiveAtProvince(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const now = deps.clock.now();
      // transition() first, so a wrong state, Vai trò, version or a second Tiếp nhận is reported as such;
      // a đợt without Hội đồng then throws and the transaction rolls the transition back.
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.province_receive",
        expectedVersion: input.expectedVersion,
        patch: { provinceReceivedAt: now, provinceReceivedBy: actor.userId, firstProvinceReceivedAt: before.firstProvinceReceivedAt ?? now },
        metadata: { roundId: before.roundId },
      });
      const round = before.roundId ? await tx.rounds.findById(before.roundId) : null;
      if (!round?.councilId) throw new DomainError("round_without_council", "Đợt của hồ sơ chưa có Hội đồng; hãy gán Hội đồng cho đợt trước khi tiếp nhận");
      return { version: after.version };
    });
  };
}
