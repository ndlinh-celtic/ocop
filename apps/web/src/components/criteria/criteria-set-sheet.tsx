import type { CriteriaSetDetail, CriteriaSetView, StoredCriterion } from "@ocop/core";
import type { EditSlot } from "./edit-target";
import { StatusTag } from "./status-tag";

/** Title, Cây phân loại path and review notes of a Bộ tiêu chí (L19). */
export function CriteriaSetHeading({ view, edit }: { view: CriteriaSetView; edit?: EditSlot }) {
  const { set } = view;
  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">
            Bộ {set.code}. {set.name}
          </h1>
          <StatusTag status={view.version.status} />
          {edit?.({ node: "set", id: set.id, label: `Bộ ${set.code}`, values: { name: set.name, totalPoints: set.totalPoints } })}
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
    </>
  );
}

/**
 * The sheet of a Bộ tiêu chí: Điều kiện loại, then Phần → Mục → (Nhóm tiêu chí) → Tiêu chí → Mức điểm.
 * Read-only unless `edit` is given (the admin draft page, L19 AD-03).
 */
export function CriteriaSetSheet({ set, edit }: { set: CriteriaSetDetail; edit?: EditSlot }) {
  return (
    <>
      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-2 font-medium">Điều kiện loại</h2>
        {set.exclusionConditions.length === 0 ? (
          <p className="text-sm text-text-3">Phiếu không có dòng &ldquo;Hồ sơ bị loại khi…&rdquo;.</p>
        ) : (
          <ol className="list-decimal pl-5 text-sm">
            {set.exclusionConditions.map((e, i) => (
              <li key={e.id}>
                {e.description} {edit?.({ node: "exclusion", id: e.id, label: `Điều kiện loại ${i + 1}`, values: { description: e.description } })}
              </li>
            ))}
          </ol>
        )}
        {edit && <div className="mt-2">{edit({ add: "exclusion", parent: { node: "set", id: set.id }, label: "Thêm điều kiện loại" })}</div>}
      </section>

      {set.parts.map((part) => (
        <section key={part.id} className="rounded-lg border bg-surface">
          <h2 className="flex justify-between gap-3 border-b bg-surface-2 px-4 py-3 font-semibold">
            <span>
              Phần {part.code}. {part.name}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {part.points} điểm
              {edit?.({ node: "part", id: part.id, label: `Phần ${part.code}`, values: { name: part.name, points: part.points } })}
            </span>
          </h2>
          <div className="flex flex-col divide-y">
            {part.sections.map((section) => (
              <div key={section.id} className="px-4 py-3">
                <h3 className="flex justify-between gap-3 font-medium">
                  <span>
                    {section.code}. {section.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-text-2">
                    {section.points} điểm
                    {edit?.({ node: "section", id: section.id, label: `Mục ${section.code}`, values: { name: section.name, points: section.points } })}
                  </span>
                </h3>
                <div className="mt-2 flex flex-col gap-3">
                  {section.items.map((item) =>
                    item.kind === "group" ? (
                      <div key={item.id} className="rounded-md border border-line-strong p-3">
                        <h4 className="flex justify-between gap-3 text-sm font-medium">
                          <span>
                            {item.code} {item.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-text-2">
                            {item.points} điểm
                            {edit?.({
                              node: "criterionGroup",
                              id: item.id,
                              label: `Nhóm tiêu chí ${item.code}`,
                              values: { name: item.name, points: item.points },
                            })}
                          </span>
                        </h4>
                        <div className="mt-2 flex flex-col gap-3">
                          {item.criteria.map((c) => (
                            <CriterionCard key={c.id} criterion={c} edit={edit} />
                          ))}
                          {edit && (
                            <div>
                              {edit({ add: "criterion", parent: { node: "criterionGroup", id: item.id }, label: `Thêm tiêu chí vào nhóm ${item.code}` })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <CriterionCard key={item.id} criterion={item} edit={edit} />
                    ),
                  )}
                  {edit && (
                    <div className="flex flex-wrap gap-2">
                      {edit({ add: "criterion", parent: { node: "section", id: section.id }, label: `Thêm tiêu chí vào mục ${section.code}` })}
                      {edit({ add: "criterionGroup", parent: { node: "section", id: section.id }, label: `Thêm nhóm tiêu chí vào mục ${section.code}` })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {edit && (
              <div className="px-4 py-3">{edit({ add: "section", parent: { node: "part", id: part.id }, label: `Thêm mục vào phần ${part.code}` })}</div>
            )}
          </div>
        </section>
      ))}
      {edit && <div>{edit({ add: "part", parent: { node: "set", id: set.id }, label: "Thêm phần" })}</div>}
    </>
  );
}

function CriterionCard({ criterion: c, edit }: { criterion: StoredCriterion; edit?: EditSlot }) {
  return (
    <article className="rounded-md bg-surface-2 p-3 text-sm">
      <header className="flex justify-between gap-3">
        <p className="font-medium">
          {c.code} {c.name}
        </p>
        <span className="flex shrink-0 items-center gap-2 text-text-2">
          tối đa {c.maxPoints} điểm
          {edit?.({
            node: "criterion",
            id: c.id,
            label: `Tiêu chí ${c.code}`,
            values: { code: c.code, name: c.name, requirement: c.requirement, note: c.note, maxPoints: c.maxPoints },
          })}
        </span>
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
            {edit && <th className="w-28 py-1" aria-label="Sửa" />}
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
              {edit && (
                <td className="py-1 text-right align-top">
                  {edit({
                    node: "scoreLevel",
                    id: l.id,
                    label: `Mức điểm ${l.description}`,
                    values: { description: l.description, points: l.points, minimumStar: l.minimumStar, branch: l.branch },
                  })}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {edit && <div className="mt-2">{edit({ add: "scoreLevel", parent: { node: "criterion", id: c.id }, label: "Thêm mức điểm" })}</div>}
    </article>
  );
}
