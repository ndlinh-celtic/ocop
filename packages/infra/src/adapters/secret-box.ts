import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { SecretBox } from "@ocop/core";

/** AES-256-GCM; output is `v1.<iv>.<tag>.<ciphertext>` in base64url so the key can be rotated later. */
export function aesGcmSecretBox(keyBase64: string): SecretBox {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  // A separate key for fingerprints, derived so the encryption key is never used for two purposes.
  const fingerprintKey = createHash("sha256").update("ocop-fingerprint-v1").update(key).digest();
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
    },
    fingerprint(plain) {
      return createHmac("sha256", fingerprintKey).update(plain, "utf8").digest("base64url");
    },
    open(sealed) {
      const [version, iv, tag, data] = sealed.split(".");
      if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised sealed secret");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    },
  };
}
