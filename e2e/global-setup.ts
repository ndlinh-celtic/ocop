import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ADMIN, STATE_FILE } from "./tests/support";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:8080";

const compose = (args: string[], env: Record<string, string> = {}) =>
  execFileSync("docker", ["compose", ...args], { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

async function waitForHealth() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const ok = await fetch(`${BASE}/api/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${BASE}/api/health did not become healthy; is \`docker compose up -d --build\` running?`);
}

export default async function globalSetup() {
  await waitForHealth();
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  try {
    // `-e NAME` without a value forwards the variable from this process into the container.
    compose(
      [
        "run",
        "--rm",
        "-T",
        "-e",
        "OCOP_ADMIN_EMAIL",
        "-e",
        "OCOP_ADMIN_NAME",
        "-e",
        "OCOP_ADMIN_PASSWORD",
        "worker",
        "pnpm",
        "--filter",
        "@ocop/infra",
        "admin:create",
      ],
      {
        OCOP_ADMIN_EMAIL: ADMIN.email,
        OCOP_ADMIN_NAME: ADMIN.fullName,
        OCOP_ADMIN_PASSWORD: ADMIN.password,
      },
    );
  } catch (err) {
    const out = `${(err as { stdout?: string }).stdout ?? ""}${(err as { stderr?: string }).stderr ?? ""}`;
    if (!out.includes("đã có Quản trị") || !existsSync(STATE_FILE)) {
      throw new Error(`Could not create the first Quản trị. Start from a fresh stack: docker compose down -v && docker compose up -d --build\n${out}`);
    }
  }
  compose(["run", "--rm", "-T", "worker", "pnpm", "--filter", "@ocop/infra", "seed:wards"]);
}
