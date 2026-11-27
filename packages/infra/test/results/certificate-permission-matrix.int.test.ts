import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { FOUR, resultsWorld, THREE } from "./results-world";

/*
 * #14 permission matrix rows for the Giấy chứng nhận (#84, L16 HD-11; spec #79 stories 17, 26 to 29, 34, 35): every
 * action on a giấy and the correction of a quyết định belong to the Cán bộ Sở alone; its settings to the Quản trị.
 * The rows share one recorded quyết định whose bản nháp are generated.
 */

type Who = "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Cán bộ xã" | "Chủ thể" | "Quản trị";
type Action =
  | "danh sách giấy chứng nhận"
  | "tải bản nháp"
  | "tải bản nháp cả quyết định"
  | "tải lên tệp giấy đã ký"
  | "ghi nhận bản đã ký"
  | "sửa số, ngày ký quyết định"
  | "cấu hình giấy chứng nhận";
type Outcome = "allowed" | "forbidden";

const WHO: Who[] = ["Cán bộ Sở", "Chủ tịch A", "Thư ký A", "Thành viên A", "Tổ tư vấn A", "Cán bộ xã", "Chủ thể", "Quản trị"];
const ACTIONS: Action[] = [
  "danh sách giấy chứng nhận",
  "tải bản nháp",
  "tải bản nháp cả quyết định",
  "tải lên tệp giấy đã ký",
  "ghi nhận bản đã ký",
  "sửa số, ngày ký quyết định",
  "cấu hình giấy chứng nhận",
];
const ROWS: [Who, Action, Outcome][] = WHO.flatMap((who) =>
  ACTIONS.map((action): [Who, Action, Outcome] => {
    const owner: Who = action === "cấu hình giấy chứng nhận" ? "Quản trị" : "Cán bộ Sở";
    return [who, action, who === owner ? "allowed" : "forbidden"];
  }),
);

describe("Permission matrix: Giấy chứng nhận (#84)", () => {
  const { w, closedMeeting, record } = resultsWorld();
  const actors = {} as Record<Who, UserActor>;
  let decisionId = "";
  let certificateIds: string[] = [];

  beforeAll(async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR]);
    ({ decisionId } = await record(meetingId));
    await w.t.drainJobs();
    certificateIds = (await w.t.app.results.listCertificates(w.province, { decisionId })).map((c) => c.id);
    Object.assign(actors, {
      "Cán bộ Sở": w.province,
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Cán bộ xã": w.ward,
      "Chủ thể": dossiers[0]!.a,
      "Quản trị": await w.f.admin(),
    });
  });

  async function attempt(who: Who, action: Action) {
    const actor = actors[who];
    switch (action) {
      case "danh sách giấy chứng nhận":
        return w.t.app.results.listCertificates(actor, {});
      case "tải bản nháp":
        return w.t.app.results.downloadCertificate(actor, { certificateId: certificateIds[0]!, version: "draft" });
      case "tải bản nháp cả quyết định":
        return w.t.app.results.certificateDrafts(actor, { decisionId });
      case "tải lên tệp giấy đã ký":
        return w.t.app.files.requestUpload(actor, { purpose: "signed_certificate", fileName: "GCN.pdf", contentType: "application/pdf", size: 1000 });
      case "ghi nhận bản đã ký": {
        const fileId = await w.f.uploadPdf(w.province, "signed_certificate", "GCN đã ký.pdf");
        return w.t.app.results.uploadSignedCertificate(actor, { certificateId: certificateIds[1]!, fileId, reason: "Bản ký lại" });
      }
      case "sửa số, ngày ký quyết định":
        return w.t.app.results.amendDecision(actor, { decisionId, number: `9/QĐ-UBND-${who.length}`, signedOn: "2026-10-18", reason: "Sửa số" });
      case "cấu hình giấy chứng nhận":
        return w.t.app.system.setCertificateSettings(actor, { codeSuffix: "GCN-OCOP", validityMonths: 36, expiryReminderMonths: 6 });
    }
  }

  it.each(ROWS)("%s — %s → %s", async (who, action, outcome) => {
    const run = attempt(who, action);
    if (outcome === "allowed") await expect(run).resolves.toBeDefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
