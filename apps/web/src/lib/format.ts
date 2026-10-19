/** Stored in UTC, shown in Vietnam time (CLAUDE.md). */
const dateTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export const formatVnDateTime = (d: Date) => dateTime.format(d);
export const formatVnDate = (d: Date) => date.format(d);
