import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

/** Deployment configuration, read once from the environment. Secrets never have defaults. */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_BASE_URL: z.string().url().default("http://localhost:8080"),
  TZ_DISPLAY: z.string().default("Asia/Ho_Chi_Minh"),
  /** ADR 0003: mandatory TOTP for every role except Chủ thể and Cán bộ xã. */
  TOTP_REQUIRED: bool,
  /** 32-byte key, base64, encrypting TOTP secrets at the application layer. */
  TOTP_ENCRYPTION_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("OCOP <no-reply@ocop.local>"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  S3_BUCKET_EVIDENCE: z.string().default("ocop-evidence"),
  S3_BUCKET_AUDIT_ANCHOR: z.string().default("ocop-audit-anchor"),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  CLAMD_HOST: z.string().default("clamd"),
  CLAMD_PORT: z.coerce.number().default(3310),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return parsed.data;
}
