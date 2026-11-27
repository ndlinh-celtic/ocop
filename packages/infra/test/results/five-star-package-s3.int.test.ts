/**
 * S3 compatibility of what the Gói đề nghị 5 sao needs (#89): a server-side multipart upload of a stream of unknown
 * length, and the backup lifecycle rule that deletes `exports/` after 7 days (the job `results.five-star-packages-expire`
 * is what removes a package; see five-star-package-expiry.int.test.ts). Runs against the local S3 container, or a
 * provider with the S3_COMPAT_* variables (see test/files/s3-compat.int.test.ts).
 */
import { GetBucketLifecycleConfigurationCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createS3FileStore, ensureBucket, type S3Settings } from "../../src/files/s3";
import { s3TestSettings } from "../support";

let settings: S3Settings;
let bucket: string;

beforeAll(async () => {
  settings = s3TestSettings();
  bucket = process.env.S3_COMPAT_BUCKET ?? `exports-${randomBytes(4).toString("hex")}`;
  await ensureBucket(settings, bucket, { corsOrigins: [], expiringPrefixes: [{ prefix: "exports/", days: 7 }] });
});

const store = () => createS3FileStore(settings, bucket);
const MiB = 1024 * 1024;

async function* chunks(count: number, size: number, hash: ReturnType<typeof createHash>, failAt?: number) {
  for (let i = 0; i < count; i++) {
    if (i === failAt) throw new Error("source failed (simulated)");
    const c = randomBytes(size);
    hash.update(c);
    yield new Uint8Array(c);
  }
}

describe("FileStore.putStream / S3 multipart from the server (#89)", () => {
  it("uploads a stream larger than one part in several parts, and reads back the same bytes", async () => {
    const key = `exports/test/${randomBytes(6).toString("hex")}.zip`;
    const sent = createHash("sha256");
    const { size } = await store().putStream(key, chunks(19, MiB, sent), "application/zip");

    expect(size).toBe(19 * MiB);
    await expect(store().head(key)).resolves.toMatchObject({ size: 19 * MiB, contentType: "application/zip" });
    const got = createHash("sha256");
    for await (const c of await store().read(key)) got.update(c);
    expect(got.digest("hex")).toBe(sent.digest("hex"));
  });

  it("leaves no object when the stream fails part-way", async () => {
    const key = `exports/test/${randomBytes(6).toString("hex")}.zip`;
    await expect(store().putStream(key, chunks(12, MiB, createHash("sha256"), 10), "application/zip")).rejects.toThrow("source failed");
    await expect(store().head(key)).resolves.toBeNull();
  });

  it("the bucket expires objects under exports/ after 7 days", async () => {
    const s3 = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region,
      forcePathStyle: settings.forcePathStyle,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    });
    const out = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
    expect(out.Rules).toEqual(expect.arrayContaining([expect.objectContaining({ Status: "Enabled", Expiration: expect.objectContaining({ Days: 7 }) })]));
    const rule = out.Rules!.find((r) => r.Expiration?.Days === 7)!;
    expect(rule.Filter?.Prefix ?? rule.Prefix).toBe("exports/");
  });
});
