import Link from "next/link";
import { requireActor } from "@/server/session";
import { NewDossier } from "./new-dossier";

export const dynamic = "force-dynamic";

/** S13 Tạo hồ sơ (L02 CT-03) of the signed-in Chủ thể; `?tu=<id>` copies that hồ sơ (story 27). */
export default async function NewDossierPage({ searchParams }: { searchParams: Promise<{ tu?: string }> }) {
  const actor = await requireActor();
  const { tu } = await searchParams;
  return (
    <NewDossier
      actor={actor}
      tu={tu}
      back={
        <Link href="/chu-the/ho-so" className="text-sm text-brand">
          ← Hồ sơ của tôi
        </Link>
      }
    />
  );
}
