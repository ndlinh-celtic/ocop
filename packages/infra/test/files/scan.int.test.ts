import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, createTestDatabase, EICAR, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a00000000049454e44ae426082",
  "hex",
);

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

async function upload(fileName: string, contentType: string, data: Buffer) {
  const admin = await t.signInAs(ADMIN.email, ADMIN.password);
  const { fileId, upload } = await t.app.files.requestUpload(admin, { fileName, contentType, size: data.length });
  if (upload.kind !== "single") throw new Error("expected single upload");
  await fetch(upload.url, { method: "PUT", headers: upload.headers, body: data });
  await t.app.files.completeUpload(admin, { fileId });
  return { admin, fileId };
}

const status = async (fileId: string) => {
  const admin = await t.signInAs(ADMIN.email, ADMIN.password);
  return (await t.app.files.list(admin)).find((f) => f.id === fileId)!;
};

describe("L24 DC-03 quarantine and virus scan", () => {
  it("a new file is in quarantine: no download until the scan says it is clean", async () => {
    const data = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(5000)]);
    const { admin, fileId } = await upload("Biên bản.pdf", "application/pdf", data);
    await expect(status(fileId)).resolves.toMatchObject({ status: "scanning" });
    await expect(t.app.files.requestDownload(admin, { fileId })).rejects.toMatchObject({ code: "file_not_ready" });

    await t.drainJobs();
    await expect(status(fileId)).resolves.toMatchObject({
      status: "clean",
      detectedType: "application/pdf",
      sha256: createHash("sha256").update(data).digest("hex"),
    });
    await expect(t.app.files.requestDownload(admin, { fileId })).resolves.toMatchObject({ url: expect.any(String) });
  });

  it("blocks a file with malware, never serves it, and tells the uploader", async () => {
    const { admin, fileId } = await upload("hoso.pdf", "application/pdf", Buffer.from(EICAR));
    await t.drainJobs();
    await expect(status(fileId)).resolves.toMatchObject({ status: "blocked", blockReason: expect.stringMatching(/mã độc/i) });
    await expect(t.app.files.requestDownload(admin, { fileId })).rejects.toMatchObject({ code: "file_not_ready" });
    const [n] = await t.app.notifications.list(admin);
    expect(n).toMatchObject({ kind: "file_blocked", title: expect.stringContaining("hoso.pdf") });
  });

  it("blocks a file whose real content does not match its declared type", async () => {
    const { fileId } = await upload("ban-scan.pdf", "application/pdf", PNG);
    await t.drainJobs();
    await expect(status(fileId)).resolves.toMatchObject({ status: "blocked", detectedType: "image/png", blockReason: expect.stringMatching(/định dạng/i) });
  });

  it("keeps the file in quarantine and retries when the scanner is unavailable", async () => {
    const { fileId } = await upload("anh.png", "image/png", PNG);
    t.scanner.failNext(1);
    await t.drainJobs();
    await expect(status(fileId)).resolves.toMatchObject({ status: "scanning" });
    await t.drainJobs({ includeRetries: true });
    await expect(status(fileId)).resolves.toMatchObject({ status: "clean" });
  });

  it("audits the scan outcome", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const actions = (await t.app.audit.search(admin, { action: ["file.scanned_clean", "file.blocked"] })).map((e) => e.action);
    expect(actions).toContain("file.scanned_clean");
    expect(actions).toContain("file.blocked");
  });
});
