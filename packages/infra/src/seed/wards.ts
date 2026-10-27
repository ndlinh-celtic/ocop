import { v7 as uuidv7 } from "uuid";
import type { Pool } from "pg";

/**
 * Loads xã/phường from a CSV with header `ma,ten` (mã đơn vị hành chính, tên). Idempotent: rows are
 * matched on the code, names are updated, nothing is deleted. Returns how many rows were read.
 */
export async function seedWards(pool: Pool, csv: string): Promise<number> {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const [header, ...rows] = lines;
  if (header?.toLowerCase().replace(/\s/g, "") !== "ma,ten") throw new Error('CSV header must be "ma,ten"');
  const wards = rows.map((line, i) => {
    const comma = line.indexOf(",");
    const code = line.slice(0, comma).trim();
    const name = line
      .slice(comma + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
    if (comma < 0 || !/^\d{5}$/.test(code) || !name) throw new Error(`Line ${i + 2}: expected "<5-digit code>,<name>"`);
    return { code, name };
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const w of wards) {
      await client.query("INSERT INTO org.ward (id, code, name) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name", [
        uuidv7(),
        w.code,
        w.name,
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return wards.length;
}
