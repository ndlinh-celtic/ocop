/*
 * Names inside the ZIP of the Gói đề nghị 5 sao (#89, spec #79): without dấu and safe on Windows, where the Bộ opens it.
 * Windows refuses <>:"/\|?* and control characters (dropped here with anything outside printable ASCII), names ending
 * in a dot or space, and the device names (CON, NUL, COM1…); Explorer struggles with long paths, so each part is short.
 */

const MAX_PART = 80;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/** Vietnamese without dấu: "Bưởi da xanh" → "Buoi da xanh", "Đồng" → "Dong". */
export function withoutDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

/** One folder or file name: printable ASCII only, Windows-safe, at most `max` characters with its extension kept. */
export function zipSafeName(name: string, max = MAX_PART): string {
  let safe = withoutDiacritics(name)
    .replace(/\s+/g, " ")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/ +/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  const dot = safe.lastIndexOf(".");
  const ext = dot > 0 && safe.length - dot <= 10 ? safe.slice(dot) : "";
  let base = ext ? safe.slice(0, dot) : safe;
  if (RESERVED.test(base.split(".")[0]!.trim())) base = `_${base}`;
  if (base.length + ext.length > max) base = base.slice(0, Math.max(1, max - ext.length)).replace(/[. ]+$/, "");
  safe = `${base}${ext}`;
  return safe || "_";
}

/**
 * Keeps names unique within one folder, as Windows compares them (case-insensitive): a repeated name gets " (2)", " (3)"…
 * before its extension.
 */
export function uniqueNames() {
  const used = new Set<string>();
  return (name: string): string => {
    const dot = name.lastIndexOf(".");
    const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  };
}
