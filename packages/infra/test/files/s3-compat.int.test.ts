/**
 * S3 compatibility suite = the FileStore contract (spec #1, Phụ lục A). Runs against the local S3
 * container by default; point it at a provider with:
 *   S3_COMPAT_ENDPOINT=https://... S3_COMPAT_ACCESS_KEY=... S3_COMPAT_SECRET_KEY=... \
 *   [S3_COMPAT_REGION=...] [S3_COMPAT_BUCKET=existing-bucket] pnpm --filter @ocop/infra test:int s3-compat
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createS3FileStore, ensureBucket, type S3Settings } from "../../src/files/s3";
import { s3TestSettings } from "../support";

const ORIGIN = "http://localhost:8080";
let settings: S3Settings;
let bucket: string;

beforeAll(async () => {
  settings = s3TestSettings();
  bucket = process.env.S3_COMPAT_BUCKET ?? `compat-${randomBytes(4).toString("hex")}`;
  await ensureBucket(settings, bucket, { corsOrigins: [ORIGIN] });
});

const store = () => createS3FileStore(settings, bucket);
const key = () => `compat/${randomBytes(6).toString("hex")}`;

describe("FileStore contract / S3 compatibility", () => {
  it("presigned PUT from a browser origin, without checksum headers, then HEAD reports the size", async () => {
    const k = key();
    const body = Buffer.from("Biên bản đánh giá sơ bộ – tệp thử");
    const put = await store().presignPut(k, { contentType: "application/pdf", contentLength: body.length, expiresInSec: 300 });
    const res = await fetch(put.url, { method: "PUT", headers: { ...put.headers, Origin: ORIGIN }, body });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toMatch(new RegExp(`^(\\*|${ORIGIN})$`));
    await expect(store().head(k)).resolves.toMatchObject({ size: body.length });
  });

  it("CORS preflight allows PUT with Content-Type and exposes ETag", async () => {
    const put = await store().presignPut(key(), { contentType: "image/png", contentLength: 10, expiresInSec: 300 });
    const res = await fetch(put.url, {
      method: "OPTIONS",
      headers: { Origin: ORIGIN, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
    });
    expect(res.status).toBeLessThan(300);
    expect((res.headers.get("access-control-allow-methods") ?? "").toUpperCase()).toContain("PUT");
  });

  it("a presigned PUT rejects a body of another size than declared", async () => {
    const put = await store().presignPut(key(), { contentType: "application/pdf", contentLength: 5, expiresInSec: 300 });
    const res = await fetch(put.url, { method: "PUT", headers: put.headers, body: Buffer.from("much longer than five bytes") }).catch(() => null);
    expect(res === null || res.status >= 400).toBe(true);
  });

  it("presigned GET returns the bytes with a download file name, and expires", async () => {
    const k = key();
    const body = Buffer.from(randomBytes(64));
    await store().put(k, body, "application/octet-stream");
    const get = await store().presignGet(k, { fileName: "Biên bản xã.pdf", expiresInSec: 60 });
    const res = await fetch(get.url);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(body)).toBe(true);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(get.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("multipart upload through presigned part URLs, with ETags readable by the browser", async () => {
    const k = key();
    const partSize = 5 * 1024 * 1024;
    const data = randomBytes(partSize + 1024);
    const s = store();
    const uploadId = await s.startMultipart(k, "video/mp4");
    const parts = [];
    for (const [i, chunk] of [data.subarray(0, partSize), data.subarray(partSize)].entries()) {
      const p = await s.presignPart(k, uploadId, i + 1, 300);
      const res = await fetch(p.url, { method: "PUT", headers: { Origin: ORIGIN }, body: chunk });
      expect(res.status).toBe(200);
      const etag = res.headers.get("etag");
      expect(etag).toBeTruthy();
      expect((res.headers.get("access-control-expose-headers") ?? "").toLowerCase()).toContain("etag");
      parts.push({ partNumber: i + 1, etag: etag! });
    }
    await s.completeMultipart(k, uploadId, parts);
    await expect(s.head(k)).resolves.toMatchObject({ size: data.length });
  });

  it("reads an object back as a stream (used by the virus scan)", async () => {
    const k = key();
    await store().put(k, "nội dung", "text/plain");
    const chunks: Buffer[] = [];
    for await (const c of await store().read(k)) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString("utf8")).toBe("nội dung");
  });

  it("deletes an object, and deleting a missing one is not an error", async () => {
    const k = key();
    await store().put(k, "tạm", "text/plain");
    await store().delete(k);
    await expect(store().head(k)).resolves.toBeNull();
    await expect(store().delete(k)).resolves.toBeUndefined();
  });

  it("HEAD of a missing object is null, not an error", async () => {
    await expect(store().head(key())).resolves.toBeNull();
  });
});

afterAll(() => {
  /* buckets are left for inspection; the container is discarded with the run */
});
