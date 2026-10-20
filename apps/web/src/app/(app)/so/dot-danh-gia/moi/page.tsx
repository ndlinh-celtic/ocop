import Link from "next/link";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { createRoundAction } from "../actions";
import { RoundForm } from "../round-form";

export const dynamic = "force-dynamic";

/** S81: new Đợt đánh giá in Nháp (L07 SO-01). */
export default async function NewRoundPage() {
  const actor = await requireActor();
  const versions = (await app().core.criteria.listVersions(actor)).filter((v) => v.status === "published");
  const year = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/so/dot-danh-gia">Đợt đánh giá</Link> / Tạo đợt
      </nav>
      <h1 className="text-xl font-semibold">Tạo đợt đánh giá</h1>
      <section className="rounded-lg border bg-surface p-4">
        <RoundForm
          action={createRoundAction}
          submitLabel="Tạo đợt (Nháp)"
          versions={versions.map((v) => ({ id: v.id, legalBasis: v.legalBasis, issuedOn: v.issuedOn }))}
          values={{
            name: "",
            year,
            submissionDeadline: "",
            forwardingDeadline: "",
            evaluationDeadline: "",
            criteriaVersionId: versions[0]?.id ?? "",
            gradingMode: "direct",
            minGraders: 5,
            deviationFlagPoints: 15,
          }}
        />
      </section>
    </div>
  );
}
