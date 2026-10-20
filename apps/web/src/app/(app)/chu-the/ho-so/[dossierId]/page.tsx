import Link from "next/link";
import { requireActor } from "@/server/session";
import { DossierEditor } from "./dossier-editor";

export const dynamic = "force-dynamic";

/** S14 Trình soạn hồ sơ (L02 CT-03, CT-05, CT-06) of the signed-in Chủ thể. */
export default async function DossierPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  return (
    <DossierEditor
      actor={actor}
      dossierId={dossierId}
      back={
        <Link href="/chu-the/ho-so" className="text-sm text-brand">
          ← Hồ sơ của tôi
        </Link>
      }
    />
  );
}
