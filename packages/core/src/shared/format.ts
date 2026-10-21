/*
 * How generated văn bản and messages write values for a Vietnamese reader. These format for display only;
 * `vnDateOf` (rounds/model.ts) is what turns an instant into its YYYY-MM-DD day in Vietnam.
 */

/** A YYYY-MM-DD day written as Vietnamese read it: DD/MM/YYYY. */
export const formatDayVn = (isoDay: string) => isoDay.split("-").reverse().join("/");

/** A number with the Vietnamese decimal comma: 12.5 is written 12,5. */
export const formatDecimalVn = (n: number) => String(n).replace(".", ",");
