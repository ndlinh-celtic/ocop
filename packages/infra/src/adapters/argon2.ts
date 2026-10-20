import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "@ocop/core";

// argon2id with OWASP's minimum (19 MiB, 2 iterations); tune upwards once the VM is sized.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password, OPTIONS),
  verify: async (digest, password) => {
    try {
      return await verify(digest, password);
    } catch {
      return false;
    }
  },
};
