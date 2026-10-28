import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * Permission matrix for Mẫu văn bản có phiên bản (#82, spec #79 stories 70 to 79): Quản trị alone manages them
 * (`documents.template.manage`); every other Vai trò is refused before anything is read.
 */

type Who = "Quản trị" | "Cán bộ Sở" | "Cán bộ xã" | "Chủ tịch" | "Thư ký" | "Thành viên" | "Tổ tư vấn" | "Chủ thể";
type Action = "xem danh sách" | "tải mẫu mặc định" | "tải tệp mẫu lên" | "ghi phiên bản" | "đặt mẫu đang dùng" | "sinh thử";

const WHO: Who[] = ["Quản trị", "Cán bộ Sở", "Cán bộ xã", "Chủ tịch", "Thư ký", "Thành viên", "Tổ tư vấn", "Chủ thể"];
const ACTIONS: Action[] = ["xem danh sách", "tải mẫu mặc định", "tải tệp mẫu lên", "ghi phiên bản", "đặt mẫu đang dùng", "sinh thử"];
const ROWS: [Who, Action, "allowed" | "forbidden"][] = WHO.flatMap((who) =>
  ACTIONS.map((a): [Who, Action, "allowed" | "forbidden"] => [who, a, who === "Quản trị" ? "allowed" : "forbidden"]),
);

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("Permission matrix: Mẫu văn bản (#82)", () => {
  const w = scoringWorld();
  const actors = {} as Record<Who, UserActor>;
  let templateFileId: string;

  beforeAll(async () => {
    const admin = await w.f.admin();
    Object.assign(actors, {
      "Quản trị": admin,
      "Cán bộ Sở": w.province,
      "Cán bộ xã": w.ward,
      "Chủ tịch": w.A.chair,
      "Thư ký": w.A.secretary,
      "Thành viên": w.A.members[0]!,
      "Tổ tư vấn": w.A.advisors[0]!,
      "Chủ thể": await w.f.owner(),
    });
    const { bytes } = await w.t.app.documents.downloadTemplate(admin, { kind: "ward_report", versionId: null });
    const { fileId, upload } = await w.t.app.files.requestUpload(admin, {
      purpose: "document_template",
      fileName: "Mẫu.docx",
      contentType: DOCX,
      size: bytes.byteLength,
    });
    if (upload.kind !== "single") throw new Error("expected a single PUT");
    await fetch(upload.url, { method: "PUT", headers: upload.headers, body: bytes });
    await w.t.app.files.completeUpload(admin, { fileId });
    await w.t.drainJobs();
    templateFileId = fileId;
  });

  const attempt = (actor: UserActor, action: Action) => {
    const docs = w.t.app.documents;
    switch (action) {
      case "xem danh sách":
        return docs.listTemplates(actor);
      case "tải mẫu mặc định":
        return docs.downloadTemplate(actor, { kind: "ward_report", versionId: null });
      case "tải tệp mẫu lên":
        return w.t.app.files.requestUpload(actor, { purpose: "document_template", fileName: "Mẫu.docx", contentType: DOCX, size: 1000 });
      case "ghi phiên bản":
        return docs.uploadTemplate(actor, { kind: "ward_report", fileId: templateFileId, activate: false });
      case "đặt mẫu đang dùng":
        return docs.activateTemplate(actor, { kind: "ward_report", versionId: null });
      case "sinh thử":
        return docs.previewTemplate(actor, { kind: "ward_report", versionId: null });
    }
  };

  // The Quản trị's rows run last, so its "ghi phiên bản" does not change what the others are refused.
  it.each([...ROWS].sort((a, b) => Number(a[0] === "Quản trị") - Number(b[0] === "Quản trị")))("%s %s: %s", async (who, action, outcome) => {
    const result = attempt(actors[who], action);
    if (outcome === "allowed") await expect(result).resolves.not.toThrow();
    else await expect(result).rejects.toMatchObject({ code: "forbidden" });
  });
});
