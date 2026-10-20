import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** What the browser does with the upload instructions. */
async function browserUpload(upload: Awaited<ReturnType<TestApp["app"]["files"]["requestUpload"]>>["upload"], data: Buffer) {
  if (upload.kind === "single") {
    const res = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: data });
    if (!res.ok) throw new Error(`PUT ${res.status}`);
    return undefined;
  }
  const parts = [];
  for (const [i, url] of upload.partUrls.entries()) {
    const res = await fetch(url, { method: "PUT", body: data.subarray(i * upload.partSize, (i + 1) * upload.partSize) });
    parts.push({ partNumber: i + 1, etag: res.headers.get("etag")! });
  }
  return parts;
}

describe("L24 DC-03 direct upload and download", () => {
  it("uploads a small PDF in one presigned PUT and downloads it through a short-lived link", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const data = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(2000)]);
    const { fileId, upload } = await t.app.files.requestUpload(admin, { fileName: "Giấy phép kinh doanh.pdf", contentType: "application/pdf", size: data.length });
    expect(upload.kind).toBe("single");
    await browserUpload(upload, data);
    await t.app.files.completeUpload(admin, { fileId });
    await t.drainJobs();

    const { url, expiresAt } = await t.app.files.requestDownload(admin, { fileId });
    // S3 signs with the real clock, so the link's lifetime is measured against it.
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000);
    const res = await fetch(url);
    expect(Buffer.from(await res.arrayBuffer()).equals(data)).toBe(true);
  });

  it("uploads a large file in presigned parts", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const data = randomBytes(17 * 1024 * 1024);
    const { fileId, upload } = await t.app.files.requestUpload(admin, { fileName: "video.mp4", contentType: "video/mp4", size: data.length });
    expect(upload.kind).toBe("multipart");
    const parts = await browserUpload(upload, data);
    await t.app.files.completeUpload(admin, { fileId, parts });
    const [file] = (await t.app.files.list(admin)).filter((f) => f.id === fileId);
    expect(file).toMatchObject({ size: data.length, fileName: "video.mp4" });
  });

  it("refuses a type outside the allowed list or a file over the size limit before issuing a URL", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.files.requestUpload(admin, { fileName: "macro.exe", contentType: "application/x-msdownload", size: 100 })).rejects.toMatchObject({
      code: "file_type_not_allowed",
    });
    await expect(t.app.files.requestUpload(admin, { fileName: "a.pdf", contentType: "image/png", size: 100 })).rejects.toMatchObject({
      code: "file_type_not_allowed",
    });
    await expect(
      t.app.files.requestUpload(admin, { fileName: "to.pdf", contentType: "application/pdf", size: 101 * 1024 * 1024 }),
    ).rejects.toMatchObject({ code: "file_too_large" });
  });

  it("completing an upload that never reached storage, or with another size, is refused", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const { fileId } = await t.app.files.requestUpload(admin, { fileName: "x.pdf", contentType: "application/pdf", size: 10 });
    await expect(t.app.files.completeUpload(admin, { fileId })).rejects.toMatchObject({ code: "upload_missing" });
    await expect(t.app.files.requestDownload(admin, { fileId })).rejects.toMatchObject({ code: "file_not_ready" });
  });

  it("two concurrent completes of the same upload move it to scanning once", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const data = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(100)]);
    const { fileId, upload } = await t.app.files.requestUpload(admin, { fileName: "doi.pdf", contentType: "application/pdf", size: data.length });
    await browserUpload(upload, data);
    const results = await Promise.allSettled([t.app.files.completeUpload(admin, { fileId }), t.app.files.completeUpload(admin, { fileId })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "already_uploaded" } });
    const uploaded = (await t.app.audit.search(admin, { targetType: "file" })).filter((e) => e.targetId === fileId && e.action === "file.uploaded");
    expect(uploaded).toHaveLength(1);
  });

  it("only Quản trị can use the test upload, and every step is audited", async () => {
    await expect(
      t.app.files.requestUpload(anonymous(), { fileName: "a.pdf", contentType: "application/pdf", size: 1 }),
    ).rejects.toMatchObject({ code: "forbidden" });
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const actions = new Set((await t.app.audit.search(admin, { targetType: "file" })).map((e) => e.action));
    expect([...actions].sort()).toEqual(["file.download_issued", "file.scanned_clean", "file.upload_requested", "file.uploaded"]);
  });
});
