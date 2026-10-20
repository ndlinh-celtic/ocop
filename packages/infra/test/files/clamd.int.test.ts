/**
 * The ClamAV adapter against a real clamd. Locally: `docker compose up -d clamd` (port 3310 on
 * localhost); CI starts a clamd service. Set CLAMD_TEST_HOST/CLAMD_TEST_PORT to point elsewhere.
 */
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { clamdScanner } from "../../src/files/clamd";
import { EICAR } from "../support";

const host = process.env.CLAMD_TEST_HOST ?? "127.0.0.1";
const port = Number(process.env.CLAMD_TEST_PORT ?? 3310);
const scanner = clamdScanner({ host, port, timeoutMs: 30_000 });
const reachable = await scanner.ping().then(
  () => true,
  () => false,
);

describe.skipIf(!reachable && !process.env.CI)("clamd adapter", () => {
  it("passes a clean stream", async () => {
    await expect(scanner.scan(Readable.from([Buffer.from("Biên bản họp hội đồng"), Buffer.alloc(200_000, 1)]))).resolves.toEqual({ clean: true });
  });

  it("finds the EICAR test signature", async () => {
    await expect(scanner.scan(Readable.from([Buffer.from(EICAR)]))).resolves.toMatchObject({ clean: false, signature: expect.stringMatching(/eicar/i) });
  });
});
