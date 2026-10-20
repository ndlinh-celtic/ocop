import { DomainError } from "../shared/errors";

/* Small helpers shared by the criteria use cases and pure functions. */

export const versionNotFound = () => new DomainError("not_found", "Không tìm thấy phiên bản tiêu chí");
export const setNotFound = () => new DomainError("not_found", "Không tìm thấy bộ tiêu chí");

/** A sorted copy, lowest `position` first; stable for equal positions. */
export const byPosition = <T extends { position: number }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.position - b.position);

export const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
