import { inject } from "vitest";
import type { S3Settings } from "../../src/files/s3";

/** The provider under test when S3_COMPAT_* is set, otherwise the local S3 container. */
export function s3TestSettings(): S3Settings {
  const env = process.env;
  if (env.S3_COMPAT_ENDPOINT) {
    return {
      endpoint: env.S3_COMPAT_ENDPOINT,
      region: env.S3_COMPAT_REGION ?? "us-east-1",
      accessKeyId: env.S3_COMPAT_ACCESS_KEY ?? "",
      secretAccessKey: env.S3_COMPAT_SECRET_KEY ?? "",
      forcePathStyle: env.S3_COMPAT_PATH_STYLE !== "false",
    };
  }
  const s3 = inject("s3");
  return { endpoint: s3.endpoint, region: "us-east-1", accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey, forcePathStyle: true };
}
