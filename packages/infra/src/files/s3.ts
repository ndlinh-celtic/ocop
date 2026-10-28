import {
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import type { FileStore } from "@ocop/core";
import { Readable } from "node:stream";

export interface S3Settings {
  /** Endpoint the app reaches (inside Docker: http://s3:9000). */
  endpoint: string;
  /** Endpoint browsers reach; presigned URLs are signed for this host. Defaults to `endpoint`. */
  publicEndpoint?: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * Domestic providers deviate from AWS (CLAUDE.md): send checksums only when an operation requires
 * them, and use path-style addressing when asked.
 */
function client(s: S3Settings, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: s.region,
    forcePathStyle: s.forcePathStyle,
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** RFC 6266 attachment header that survives Vietnamese file names. */
const attachment = (fileName: string) =>
  `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

export function createS3FileStore(s: S3Settings, bucket: string): FileStore {
  const internal = client(s, s.endpoint);
  const signer = client(s, s.publicEndpoint ?? s.endpoint);
  const expiry = (sec: number) => new Date(Date.now() + sec * 1000);
  return {
    async presignPut(key, { contentType, contentLength, expiresInSec }) {
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
      const url = await getSignedUrl(signer, cmd, { expiresIn: expiresInSec, signableHeaders: new Set(["content-type", "content-length"]) });
      return { url, headers: { "Content-Type": contentType }, expiresAt: expiry(expiresInSec) };
    },
    async startMultipart(key, contentType) {
      const out = await internal.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }));
      if (!out.UploadId) throw new Error("Storage did not return an UploadId");
      return out.UploadId;
    },
    async presignPart(key, uploadId, partNumber, expiresInSec) {
      const cmd = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber });
      return { url: await getSignedUrl(signer, cmd, { expiresIn: expiresInSec }), headers: {}, expiresAt: expiry(expiresInSec) };
    },
    async completeMultipart(key, uploadId, parts) {
      await internal.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts.sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
        }),
      );
    },
    async head(key) {
      try {
        const out = await internal.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: out.ContentLength ?? 0, contentType: out.ContentType };
      } catch (err) {
        if (err instanceof NotFound || (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    async presignGet(key, { fileName, expiresInSec }) {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: attachment(fileName) });
      return { url: await getSignedUrl(signer, cmd, { expiresIn: expiresInSec }), headers: {}, expiresAt: expiry(expiresInSec) };
    },
    async read(key) {
      const out = await internal.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!out.Body) throw new Error(`Empty body for ${key}`);
      return out.Body as Readable;
    },
    async put(key, body, contentType) {
      await internal.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async putStream(key, body, contentType) {
      let size = 0;
      const counted = Readable.from(
        (async function* () {
          for await (const chunk of body) {
            size += chunk.byteLength;
            yield chunk;
          }
        })(),
      );
      // Multipart in parts of 8 MiB, two at a time; a failure aborts the upload (leavePartsOnError false).
      const upload = new Upload({
        client: internal,
        params: { Bucket: bucket, Key: key, Body: counted, ContentType: contentType },
        partSize: 8 * 1024 * 1024,
        queueSize: 2,
        leavePartsOnError: false,
      });
      await upload.done();
      return { size };
    },
    async delete(key) {
      await internal.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/**
 * Creates the bucket if missing and sets the CORS rules browsers need for direct upload.
 * Used locally and by the compatibility suite; in staging/prod buckets are provisioned by ops.
 */
export async function ensureBucket(
  s: S3Settings,
  bucket: string,
  opts: { corsOrigins: string[]; expiringPrefixes?: { prefix: string; days: number }[] },
): Promise<void> {
  const c = client(s, s.endpoint);
  try {
    await c.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await c.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  // Exports such as the Gói đề nghị 5 sao (#89) live under a prefix the bucket deletes after some days.
  if (opts.expiringPrefixes?.length) {
    await c.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: bucket,
        LifecycleConfiguration: {
          Rules: opts.expiringPrefixes.map((r) => ({
            ID: `expire-${r.prefix.replace(/[^a-z0-9]+/gi, "-")}${r.days}d`,
            Status: "Enabled",
            Filter: { Prefix: r.prefix },
            Expiration: { Days: r.days },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          })),
        },
      }),
    );
  }
  if (opts.corsOrigins.length === 0) return;
  await c.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: opts.corsOrigins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
}
