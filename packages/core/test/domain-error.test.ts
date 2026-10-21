import { describe, expect, it, vi } from "vitest";

type ErrorsModule = typeof import("../src/shared/errors");
type PublishModule = typeof import("../src/criteria/publish");
type ImportModule = typeof import("../src/criteria/qd26-file");

/** A fresh copy of the modules, as Next bundles one for server components and another for server actions. */
async function copy(): Promise<{ errors: ErrorsModule; publish: PublishModule; qd26: ImportModule }> {
  vi.resetModules();
  return {
    errors: await import("../src/shared/errors"),
    publish: await import("../src/criteria/publish"),
    qd26: await import("../src/criteria/qd26-file"),
  };
}

describe("DomainError instanceof across module copies", () => {
  it("knows a DomainError made by another copy of the module", async () => {
    const a = await copy();
    const b = await copy();
    expect(a.errors.DomainError).not.toBe(b.errors.DomainError);
    expect(new b.errors.DomainError("x") instanceof a.errors.DomainError).toBe(true);
    expect(new b.publish.CriteriaValidationError([]) instanceof a.errors.DomainError).toBe(true);
  });

  it("knows a subclass instance made by another copy as that subclass", async () => {
    const a = await copy();
    const b = await copy();
    expect(new b.publish.CriteriaValidationError([]) instanceof a.publish.CriteriaValidationError).toBe(true);
    expect(new b.qd26.CriteriaImportError([]) instanceof a.qd26.CriteriaImportError).toBe(true);
  });

  it("does not take a plain DomainError, or another subclass, for a subclass", async () => {
    const a = await copy();
    const b = await copy();
    expect(new a.errors.DomainError("reauth_required") instanceof a.publish.CriteriaValidationError).toBe(false);
    expect(new b.errors.DomainError("reauth_required") instanceof a.publish.CriteriaValidationError).toBe(false);
    expect(new b.qd26.CriteriaImportError([]) instanceof a.publish.CriteriaValidationError).toBe(false);
  });

  it("does not take a plain Error or a look-alike object for a DomainError", async () => {
    const { errors } = await copy();
    expect(new Error("x") instanceof errors.DomainError).toBe(false);
    expect({ code: "x" } instanceof errors.DomainError).toBe(false);
    expect(null instanceof errors.DomainError).toBe(false);
  });
});
