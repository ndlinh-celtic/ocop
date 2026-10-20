import { DomainError, type StoredCriterion } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { StatusTag } from "../../../status-tag";

export const dynamic = "force-dynamic";

const orNotFound = (err: unknown) => (err instanceof DomainError && err.code === "not_found" ? null : Promise.reject(err));

/** One Bộ tiêu chí: Phần → Mục → (Nhóm tiêu chí) → Tiêu chí → Mức điểm, and its Điều kiện loại (L19). */
export default async function CriteriaSetPage({ params }: { params: Promise<{ versionId: string; setId: string }> }) {
  const { versionId, setId } = await params;
  const actor = await requireActor();
  const view = await app().core.criteria.getCriteriaSet(actor, { setId }).catch(orNotFound);
  if (!view || view.version.id !== versionId) notFound();
  const { set } = view;
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/quan-tri/bo-tieu-chi">Phiên bản tiêu chí</Link> / <Link href={`/quan-tri/bo-tieu-chi/${versionId}`}>{view.version.legalBasis}</Link> / Bộ{" "}
        {set.code}
      </nav>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">
            Bộ {set.code}. {set.name}
          </h1>
          <StatusTag status={view.version.status} />
        </div>
        <p className="text-sm text-text-2">
          {view.productGroup} › {view.subgroup} · {set.totalPoints} điểm
          {set.sourcePages.length > 0 && ` · trang PDF ${set.sourcePages.join("–")}`}
        </p>
      </div>

      {(set.extractionNote || set.footerNote) && (
        <section className="rounded-lg border border-amber bg-amber-soft p-4 text-sm">
          {set.extractionNote && (
            <p>
              <b>Ghi chú bóc tách:</b> {set.extractionNote}
            </p>
          )}
          {set.footerNote && <p className="mt-1 text-text-2">{set.footerNote}</p>}
        </section>
      )}

      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-2 font-medium">Điều kiện loại</h2>
        {set.exclusionConditions.length === 0 ? (
          <p className="text-sm text-text-3">Phiếu không có dòng &ldquo;Hồ sơ bị loại khi…&rdquo;.</p>
        ) : (
          <ol className="list-decimal pl-5 text-sm">
            {set.exclusionConditions.map((e) => (
              <li key={e.id}>{e.description}</li>
            ))}
          </ol>
        )}
      </section>

      {set.parts.map((part) => (
        <section key={part.id} className="rounded-lg border bg-surface">
          <h2 className="flex justify-between gap-3 border-b bg-surface-2 px-4 py-3 font-semibold">
            <span>
              Phần {part.code}. {part.name}
            </span>
            <span className="shrink-0">{part.points} điểm</span>
          </h2>
          <div className="flex flex-col divide-y">
            {part.sections.map((section) => (
              <div key={section.id} className="px-4 py-3">
                <h3 className="flex justify-between gap-3 font-medium">
                  <span>
                    {section.code}. {section.name}
                  </span>
                  <span className="shrink-0 text-text-2">{section.points} điểm</span>
                </h3>
                <div className="mt-2 flex flex-col gap-3">
                  {section.items.map((item) =>
                    item.kind === "group" ? (
                      <div key={item.id} className="rounded-md border border-line-strong p-3">
                        <h4 className="flex justify-between gap-3 text-sm font-medium">
                          <span>
                            {item.code} {item.name}
                          </span>
                          <span className="shrink-0 text-text-2">{item.points} điểm</span>
                        </h4>
                        <div className="mt-2 flex flex-col gap-3">
                          {item.criteria.map((c) => (
                            <CriterionCard key={c.id} criterion={c} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <CriterionCard key={item.id} criterion={item} />
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CriterionCard({ criterion: c }: { criterion: StoredCriterion }) {
  return (
    <article className="rounded-md bg-surface-2 p-3 text-sm">
      <header className="flex justify-between gap-3">
        <p className="font-medium">
          {c.code} {c.name}
        </p>
        <span className="shrink-0 text-text-2">tối đa {c.maxPoints} điểm</span>
      </header>
      {c.requirement && <p className="mt-1 text-text-2">{c.requirement}</p>}
      {c.note && <p className="mt-1 text-text-3">Ghi chú: {c.note}</p>}
      {c.extractionNote && <p className="mt-1 text-warning">Ghi chú bóc tách: {c.extractionNote}</p>}
      <table className="mt-2 w-full">
        <thead className="text-xs text-text-3">
          <tr>
            <th className="w-12 py-1 text-left font-normal">Nhánh</th>
            <th className="py-1 text-left font-normal">Mức điểm</th>
            <th className="w-20 py-1 text-right font-normal">Sao tối thiểu</th>
            <th className="w-14 py-1 text-right font-normal">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {c.levels.map((l) => (
            <tr key={l.id} className="border-t border-line">
              <td className="py-1 align-top">{l.branch ?? ""}</td>
              <td className="py-1 align-top">
                {l.description}
                {l.systemAdded && <span className="ml-2 rounded-full bg-surface px-2 text-xs text-text-3 ring-1 ring-line-strong">hệ thống thêm</span>}
              </td>
              <td className="py-1 text-right align-top text-amber">
                {l.minimumStar ? (
                  <>
                    <span aria-hidden>{"★".repeat(l.minimumStar)}</span>
                    <span className="sr-only">{l.minimumStar} sao</span>
                  </>
                ) : (
                  ""
                )}
              </td>
              <td className="py-1 text-right align-top font-medium">{l.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
