/** Marks a DomainError whichever copy of this module made it. */
const BRAND = Symbol.for("ocop.DomainError");

/** A rule refused the request. `code` is stable and maps to a Vietnamese message in the UI. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DomainError";
    Object.defineProperty(this, BRAND, { value: true });
  }

  /**
   * `instanceof` checks the brand, not the prototype: the web app can load two copies of this module
   * (Next bundles server components and server actions separately) while sharing one Core, so an error
   * thrown by that Core may come from the other copy.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return typeof value === "object" && value !== null && BRAND in value;
  }
}

export const forbidden = () => new DomainError("forbidden", "Không có quyền thực hiện thao tác này");
