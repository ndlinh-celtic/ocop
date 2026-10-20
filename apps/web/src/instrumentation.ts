/** Runs once per server process: ADR 0003 asks each process to audit the TOTP flag it starts with. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { app } = await import("./server/app");
  const { systemActor } = await import("@ocop/core");
  await app().core.system.recordStartup(systemActor("web", { requestId: crypto.randomUUID(), userAgent: "process:web" }), { process: "web" });
}
