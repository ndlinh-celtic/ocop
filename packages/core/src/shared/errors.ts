/** A rule refused the request. `code` is stable and maps to a Vietnamese message in the UI. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DomainError";
  }
}

export const forbidden = () => new DomainError("forbidden", "Không có quyền thực hiện thao tác này");
