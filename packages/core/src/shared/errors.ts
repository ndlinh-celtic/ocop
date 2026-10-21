/** Holds, on a DomainError, the brands of its class chain, whichever copy of this module made it. */
const BRANDS = Symbol.for("ocop.DomainError.brands");

/**
 * A rule refused the request. `code` is stable and maps to a Vietnamese message in the UI.
 *
 * A subclass sets its own `static override readonly brand`, unique among DomainError classes, so that
 * `instanceof` recognises its instances made by another copy of the module, and only those.
 */
export class DomainError extends Error {
  static readonly brand: string = "DomainError";

  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DomainError";
    const brands: string[] = [];
    for (let c: unknown = new.target; typeof c === "function" && c !== Error; c = Object.getPrototypeOf(c)) {
      if (Object.hasOwn(c, "brand")) brands.push((c as typeof DomainError).brand);
    }
    Object.defineProperty(this, BRANDS, { value: brands });
  }

  /**
   * `instanceof` checks the brands, not the prototype: the web app can load two copies of this module
   * (Next bundles server components and server actions separately) while sharing one Core, so an error
   * thrown by that Core may come from the other copy. A subclass without its own brand falls back to the
   * prototype check.
   */
  static override [Symbol.hasInstance](value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const brands = (value as { [BRANDS]?: unknown })[BRANDS];
    if (!Array.isArray(brands)) return false;
    if (!Object.hasOwn(this, "brand")) return Function.prototype[Symbol.hasInstance].call(this, value);
    return brands.includes(this.brand);
  }
}

export const forbidden = () => new DomainError("forbidden", "Không có quyền thực hiện thao tác này");
