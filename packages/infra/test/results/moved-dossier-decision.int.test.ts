import PizZip from "pizzip";
import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { ADMIN } from "../dossiers/fixtures";
import { FOUR, resultsWorld, THREE } from "./results-world";

/*
 * L16 HD-11 (#83, spec #79, product owner 2026-10-29): a hồ sơ chốt in Phiên họp A, then Mở khóa sau chốt and chốt
 * again in Phiên họp B, follows B's Quyết định công nhận. It is no longer part of A's: A records its quyết định for the
 * hồ sơ left, and A's views and dự thảo quyết định leave it out. A hồ sơ Mở khóa and not yet chốt anywhere else still
 * blocks A (story 11).
 */
describe("L16 a hồ sơ chốt again in another Phiên họp leaves the first one's quyết định (#83)", () => {
  const { w, finalize, closedMeeting, record } = resultsWorld();
  let admin: UserActor;
  beforeAll(async () => {
    admin = await w.f.admin();
  });

  const unlock = async (dossierId: string) => {
    await w.t.app.identity.reauthenticate(admin, { password: ADMIN.password });
    await w.t.app.scoring.unlockFinalized(admin, {
      dossierId,
      requestFileId: await w.f.uploadPdf(admin, "unlock_request", "Công văn đề nghị mở khóa.pdf"),
      requestedBy: "Chủ tịch Hội đồng A",
      reason: "Sai sót khi chấm",
    });
  };

  const meetingWith = (title: string, dossierIds: string[]) =>
    w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title, heldOn: "2026-10-26", location: "Phòng họp Sở", dossierIds });

  /** Phiên họp A with a hồ sơ 3 sao and a hồ sơ 4 sao, the 4 sao one Mở khóa and chốt again in Phiên họp B, both closed. */
  async function moved() {
    const a = await closedMeeting([THREE, FOUR]);
    const [three, four] = a.dossiers.map((d) => d.dossierId) as [string, string];
    await unlock(four);
    const { meetingId: b } = await meetingWith("Phiên họp B", [four]);
    await finalize(four);
    await w.t.app.scoring.closeMeeting(w.A.secretary, { meetingId: b });
    return { a: a.meetingId, b, three, four };
  }

  it("records A's quyết định for the hồ sơ left and B's for the moved one", async () => {
    const { a, b, three, four } = await moved();

    expect((await record(a)).dossiers).toEqual([{ dossierId: three, section: "three_star" }]);
    expect((await w.t.app.dossiers.get(w.province, { dossierId: four })).state).toBe("score_finalized");
    expect((await record(b, w.province, { number: "124/QĐ-UBND" })).dossiers).toEqual([{ dossierId: four, section: "four_star" }]);
    expect((await w.t.app.dossiers.get(w.province, { dossierId: four })).state).toBe("recognized");
  });

  it("leaves the moved hồ sơ out of A's view and count, and lists it under B", async () => {
    const { a, b, three, four } = await moved();

    const view = await w.t.app.results.meetingDecision(w.province, { meetingId: a });
    expect(view.dossiers.map((d) => d.dossierId)).toEqual([three]);
    const viewB = await w.t.app.results.meetingDecision(w.province, { meetingId: b });
    expect(viewB.dossiers.map((d) => [d.dossierId, d.section])).toEqual([[four, "four_star"]]);
    const list = await w.t.app.results.meetingsForDecision(w.province);
    expect(list.find((m) => m.id === a)!.dossierCount).toBe(1);
    expect(list.find((m) => m.id === b)!.dossierCount).toBe(1);
  });

  it("leaves the moved hồ sơ out of A's dự thảo quyết định, which then has only số liệu đã chốt", async () => {
    const { a } = await moved();

    const { bytes } = await w.t.app.scoring.generateMeetingDocument(w.A.secretary, { meetingId: a, kind: "decision" });
    const doc = docxText(bytes);
    expect(doc).toContain("Công nhận 1 sản phẩm đạt chuẩn OCOP");
    expect(doc).toContain("Sản phẩm được công nhận đạt 3 sao (1 sản phẩm)");
    expect(doc).not.toContain("4 sao");
    expect(doc).toContain("Số liệu đã chốt của toàn bộ hồ sơ trong Phiên họp.");
  });

  it("still blocks A while the hồ sơ Mở khóa is not chốt again anywhere, even once added to Phiên họp B (story 11)", async () => {
    const { meetingId: a, dossiers } = await closedMeeting([THREE, FOUR]);
    const four = dossiers[1]!.dossierId;
    await unlock(four);

    await expect(record(a)).rejects.toMatchObject({ code: "meeting_has_pending_dossiers", dossiers: [{ dossierId: four }] });
    await meetingWith("Phiên họp B", [four]);
    await expect(record(a)).rejects.toMatchObject({ code: "meeting_has_pending_dossiers", dossiers: [{ dossierId: four }] });
    expect((await w.t.app.results.meetingDecision(w.province, { meetingId: a })).dossiers).toHaveLength(2);
  });
});

function docxText(bytes: Uint8Array) {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>\s*<\/w:tc>/g, " | ")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}
