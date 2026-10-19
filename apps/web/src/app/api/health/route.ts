import { checkDatabase } from "@ocop/infra";
import { app } from "@/server/app";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabase(app().pool);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
