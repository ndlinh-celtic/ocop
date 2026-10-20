import { authorize, can } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import { roundNotFound } from "./manage";
import type { Round } from "./model";

/** A round as every signed-in Người dùng sees it, with the văn bản căn cứ of its Phiên bản tiêu chí. */
export interface RoundView extends Round {
  criteriaVersion: { id: string; legalBasis: string; issuedOn: string };
}

/** A Nháp round is the Cán bộ Sở's work in progress: only those who manage rounds see it; to others it does not exist. */
export const roundVisibleTo = (actor: Actor, round: Round) => round.status !== "draft" || can(actor, "round.manage");

async function withVersions(tx: Tx, rounds: Round[]): Promise<RoundView[]> {
  const ids = [...new Set(rounds.map((r) => r.criteriaVersionId))];
  const versions = new Map((await Promise.all(ids.map((id) => tx.criteriaVersions.findById(id)))).flatMap((v) => (v ? [[v.id, v] as const] : [])));
  return rounds.map((r) => {
    const v = versions.get(r.criteriaVersionId);
    return { ...r, criteriaVersion: { id: r.criteriaVersionId, legalBasis: v?.legalBasis ?? "", issuedOn: v?.issuedOn ?? "" } };
  });
}

/** L07 (spec #16 story 54): every Đợt đánh giá with its Trạng thái đợt, deadlines and Phiên bản tiêu chí. */
export function listRounds(deps: CoreDeps) {
  return async (actor: Actor): Promise<RoundView[]> => {
    authorize(actor, "round.read");
    return deps.uow.run(async (tx) => withVersions(tx, (await tx.rounds.list()).filter((r) => roundVisibleTo(actor, r))));
  };
}

export function getRound(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string }): Promise<RoundView> => {
    authorize(actor, "round.read");
    return deps.uow.run(async (tx) => {
      const round = await tx.rounds.findById(input.roundId);
      if (!round || !roundVisibleTo(actor, round)) throw roundNotFound();
      const [view] = await withVersions(tx, [round]);
      return view!;
    });
  };
}

/** L02 (spec #16 story 55): the round Đang nhận nộp, whose Phiên bản tiêu chí a new hồ sơ uses; null if none. */
export function currentOpenRound(deps: CoreDeps) {
  return async (actor: Actor): Promise<RoundView | null> => {
    authorize(actor, "round.read");
    return deps.uow.run(async (tx) => {
      const round = await tx.rounds.findOpen();
      return round ? (await withVersions(tx, [round]))[0]! : null;
    });
  };
}
