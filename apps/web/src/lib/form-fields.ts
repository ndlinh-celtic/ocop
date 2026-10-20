import { z } from "zod";

/*
 * Number fields of a FormData. z.coerce.number() alone turns an empty field into 0 (Number("") === 0), so a
 * blank or missing value would be saved as 0; here it becomes undefined first and fails like any missing field.
 */

const blankToUndefined = (value: unknown) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value);

/** A required finite number. */
export const formNumber = () => z.preprocess(blankToUndefined, z.coerce.number().finite());

/** A required integer. */
export const formInteger = () => z.preprocess(blankToUndefined, z.coerce.number().int());
