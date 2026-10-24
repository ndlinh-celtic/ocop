import { describe, expect, it } from "vitest";
import { can, DOSSIER_ACTIONS, DOSSIER_STATES, type DossierRef, type UserActor } from "../src";

/*
 * TM-12 (#56, spec #49 story 64): the Tổ tư vấn only proposes. Whatever rows later tickets add to the transition
 * table, a Thành viên Tổ tư vấn Phân công on a hồ sơ may take no action on it but writing, issuing and copying the
 * Báo cáo Tổ tư vấn and asking the Sở to trả về: never Giao chấm, Phân công, a Phiếu chấm, Trả phiếu nor chốt.
 * The use-case rows of the same rule are in infra test/scoring/advisory-report-permission-matrix.
 */
const ADVISORY_ACTIONS = ["dossier.advisory_report.edit", "dossier.advisory_report.issue", "dossier.advisory_report.reissue", "dossier.advisory_copy", "dossier.advisory_return_request"];

const advisor = {
  kind: "user",
  userId: "u1",
  fullName: "Tổ tư vấn",
  email: "ttv@tinh.gov.vn",
  sessionId: "s1",
  activeRole: "advisory_member",
  activeAssignmentId: "r1",
  activeScope: { type: "council", id: "c1" },
} as unknown as UserActor;

describe("TM-12 the Tổ tư vấn proposes and never grades (story 64)", () => {
  it("takes, on a hồ sơ it is Phân công on, only the actions of the Báo cáo Tổ tư vấn, in any state", () => {
    const taken = DOSSIER_STATES.flatMap((state) => {
      const ref: DossierRef = { state, entityId: "e1", wardId: "w1", firstForwardedAt: new Date(), firstProvinceReceivedAt: new Date(), councilId: "c1", readerAssignment: "advisory" };
      return DOSSIER_ACTIONS.filter((action) => can(advisor, action, ref));
    });
    expect(taken.length).toBeGreaterThan(0);
    expect([...new Set(taken)].filter((a) => !ADVISORY_ACTIONS.includes(a))).toEqual([]);
  });
});
