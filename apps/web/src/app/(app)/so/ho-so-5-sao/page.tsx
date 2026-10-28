import { Star } from "lucide-react";
import Link from "next/link";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { DownloadButton } from "@/components/download-button";
import { EmptyState } from "@/components/empty-state";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { downloadMinistryDocumentAction } from "./actions";
import { ExportPackageForm } from "./export-package-form";
import { FiveStarActions } from "./five-star-actions";

const PACKAGE_FORM = "five-star-package";

const PACKAGE_STATE_LABEL = { pending: "Đang tạo", ready: "Sẵn sàng", failed: "Lỗi" } as const;

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "cho-bo-sung", label: "Chờ Quyết định công nhận bổ sung" },
] as const;

/**
 * L17 SO-04 (#87, spec #79 stories 46, 53 to 55, 58, 59): the "Đề xuất 5 sao" list of the Cán bộ Sở. Hồ sơ 5 sao Công bố
 * wait to be sent to the Bộ; hồ sơ Đã gửi đề nghị 5 sao wait for the Bộ's answer, or, chuyển về, for a Quyết định công
 * nhận bổ sung (the filter of story 55).
 */
export default async function FiveStarPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const actor = await requireActor();
  const { loc = "" } = await searchParams;
  const awaiting = loc === "cho-bo-sung";
  const [rows, packages] = await Promise.all([
    app().core.results.fiveStarList(actor, awaiting ? { awaiting: true } : {}),
    app().core.results.fiveStarPackages(actor),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Đề xuất 5 sao</h1>
        <p className="text-sm text-text-2">
          Hồ sơ đạt điểm đề nghị Trung ương đánh giá 5 sao. Gửi hồ sơ cho Bộ ngoài hệ thống rồi đánh dấu đã gửi; khi có kết quả của Bộ, chuyển về công nhận cấp
          tỉnh hoặc đóng hồ sơ.
        </p>
      </div>
      <nav className="flex gap-2 text-sm" aria-label="Lọc danh sách">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/so/ho-so-5-sao?loc=${f.key}` : "/so/ho-so-5-sao"}
            aria-current={loc === f.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${loc === f.key ? "border-brand bg-brand text-white" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={Star} title={awaiting ? "Không có hồ sơ chờ Quyết định công nhận bổ sung" : "Chưa có hồ sơ đề xuất 5 sao"}>
          Hồ sơ 5 sao xuất hiện ở đây khi Sở ghi nhận Quyết định công nhận của Phiên họp đã chốt hồ sơ.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <div className="border-b px-3 py-2">
            <ExportPackageForm id={PACKAGE_FORM} />
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">
                  <span className="sr-only">Chọn để xuất gói</span>
                </th>
                <th className="px-3 py-2">Mã hồ sơ</th>
                <th className="px-3 py-2">Sản phẩm, Chủ thể</th>
                <th className="px-3 py-2">Kết quả chốt</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Đề nghị gửi Bộ</th>
                <th className="px-3 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dossierId} className="border-b align-top last:border-0" data-testid="five-star-row">
                  <td className="px-3 py-2">
                    <input type="checkbox" form={PACKAGE_FORM} name="dossierIds" value={r.dossierId} aria-label={`Chọn hồ sơ ${r.code} để xuất gói`} />
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    <Link href={`/so/ho-so/${r.dossierId}`} className="text-brand">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.productName || "(Chưa đặt tên sản phẩm)"}</div>
                    <div className="text-text-3">
                      {r.entityName}
                      {r.wardName ? ` · ${r.wardName}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.star} sao · {formatPoints(r.total)} điểm
                  </td>
                  <td className="px-3 py-2">
                    <DossierStateTag state={r.state} />
                    {r.awaitingSupplementaryDecision && <div className="mt-1 text-amber">Chờ Quyết định công nhận bổ sung</div>}
                  </td>
                  <td className="px-3 py-2">
                    {r.dispatch ? (
                      <span>
                        Công văn {r.dispatch.number}, ngày {formatIsoDate(r.dispatch.sentOn)}
                      </span>
                    ) : (
                      <span className="text-text-3">Chưa gửi</span>
                    )}
                    {r.returnFile && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-text-2">{r.returnFile.fileName}</span>
                        {r.returnFile.status === "clean" ? (
                          <DownloadButton fileId={`${r.dossierId}:${r.returnFile.id}`} download={downloadMinistryDocumentAction} label="Tải" />
                        ) : r.returnFile.status === "blocked" ? (
                          <span className="text-danger">Tệp bị chặn</span>
                        ) : (
                          <span className="text-amber">Đang quét virus</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <FiveStarActions dossierId={r.dossierId} code={r.code} state={r.state} version={r.version} awaiting={r.awaitingSupplementaryDecision} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Gói đề nghị 5 sao đã xuất</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-text-3">Chưa xuất gói nào. Chọn hồ sơ trong danh sách rồi bấm Xuất gói đề nghị 5 sao.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-2">
                <tr>
                  <th className="px-3 py-2">Xuất lúc</th>
                  <th className="px-3 py-2">Người xuất</th>
                  <th className="px-3 py-2">Hồ sơ</th>
                  <th className="px-3 py-2">Tình trạng</th>
                  <th className="px-3 py-2">Tải về</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id} className="border-b align-top last:border-0" data-testid="five-star-package-row">
                    <td className="px-3 py-2 whitespace-nowrap">{formatVnDateTime(p.requestedAt)}</td>
                    <td className="px-3 py-2">{p.requestedByName}</td>
                    <td className="px-3 py-2 font-mono">{p.dossiers.map((d) => d.code).join(", ")}</td>
                    <td className="px-3 py-2">
                      {PACKAGE_STATE_LABEL[p.state]}
                      {p.failure && <div className="text-danger">{p.failure}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {p.state !== "ready" ? (
                        <span className="text-text-3">—</span>
                      ) : p.expired ? (
                        <span className="text-text-3">Đã hết hạn tải, hãy xuất lại</span>
                      ) : (
                        <span className="flex flex-col">
                          <a href={`/so/ho-so-5-sao/goi/${p.id}`} className="text-brand">
                            Tải gói{p.size !== null ? ` (${formatSize(p.size)})` : ""}
                          </a>
                          {p.expiresAt && <span className="text-text-3">Hạn tải {formatVnDateTime(p.expiresAt)}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
