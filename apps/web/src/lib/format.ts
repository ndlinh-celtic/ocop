/** Stored in UTC, shown in Vietnam time (CLAUDE.md). */
const dateTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export const formatVnDateTime = (d: Date) => dateTime.format(d);
export const formatVnDate = (d: Date) => date.format(d);
const time = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", timeStyle: "short" });
export const formatVnTime = (d: Date) => time.format(d);

/** A calendar date stored as YYYY-MM-DD (ngày cấp, hiệu lực đến), shown as dd/mm/yyyy. */
export const formatIsoDate = (iso: string) => iso.split("-").reverse().join("/");
