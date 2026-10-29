import { Stamp } from "lucide-react";
import Link from "next/link";
import { DownloadButton } from "@/components/download-button";
import { EmptyState } from "@/components/empty-state";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { downloadDecisionAction } from "../../phien-hop/[meetingId]/actions";
import { AmendDecisionForm } from "../../phien-hop/[meetingId]/amend-form";
import { SupplementaryDecisionForm } from "./supplementary-form";

export const dynamic = "force-dynamic";

/**
 * L17 (#88, spec #79 stories 56, 57; ADR 0009): the Quyết định công nhận bổ sung of the Cán bộ Sở. The hồ sơ 5 sao the
 * Bộ trả về wait here; the Sở picks them, tải dự thảo, records the signed quyết định. Below, those recorded, each with its
 * PDF and the form to sửa số hoặc ngày ký (same as a quyết định theo Phiên họp).
 */
export default async function SupplementaryDecisionPage() {
  const actor = await requireActor();
  const [waiting, decisions] = await Promise.all([
    app().core.results.fiveStarList(actor, { awaiting: true }),
    app().core.results.supplementaryDecisions(actor),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/so/ho-so-5-sao?loc=cho-bo-sung" className="text-sm text-brand">
          ← Đề xuất 5 sao
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Quyết định công nhận bổ sung</h1>
        <p className="text-sm text-text-2">
          Hồ sơ đã gửi đề nghị 5 sao được Trung ương chuyển về công nhận cấp tỉnh. Quyết định bổ sung công nhận 4 sao; kết quả chốt và hạng sao của hồ sơ không
          đổi.
        </p>
      </div>
      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card" aria-labelledby="ho-so-cho">
        <h2 id="ho-so-cho" className="font-semibold">
          Hồ sơ chờ quyết định
        </h2>
        {waiting.length === 0 ? (
          <EmptyState icon={Stamp} title="Không có hồ sơ chờ Quyết định công nhận bổ sung">
            Hồ sơ xuất hiện ở đây khi Sở chuyển về công nhận cấp tỉnh một hồ sơ đã gửi đề nghị 5 sao.
          </EmptyState>
        ) : (
          <SupplementaryDecisionForm
            dossiers={waiting.map((r) => ({
              dossierId: r.dossierId,
              code: r.code,
              productName: r.productName,
              entityName: r.entityName,
              star: r.star,
              total: r.total,
            }))}
          />
        )}
      </section>
      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card" aria-labelledby="da-ghi-nhan">
        <h2 id="da-ghi-nhan" className="font-semibold">
          Quyết định đã ghi nhận
        </h2>
        {decisions.length === 0 ? (
          <p className="text-sm text-text-3">Chưa có Quyết định công nhận bổ sung.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {decisions.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 border-b pb-4 text-sm last:border-0 last:pb-0" data-testid="supplementary-decision">
                <RefreshWhileScanning active={d.file.status === "scanning"} />
                <p>
                  Số <b>{d.number}</b>, ký ngày {formatIsoDate(d.signedOn)}. Ghi nhận bởi {d.recordedBy.fullName} lúc {formatVnDateTime(d.recordedAt)}.
                </p>
                <p className="text-text-2">
                  {d.dossiers.map((x, i) => (
                    <span key={x.dossierId}>
                      {i > 0 && ", "}
                      <Link href={`/so/ho-so/${x.dossierId}`} className="font-mono text-brand">
                        {x.code}
                      </Link>{" "}
                      {x.productName}
                    </span>
                  ))}
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  <b>{d.file.fileName}</b>
                  {d.file.status === "clean" ? (
                    <DownloadButton fileId={d.id} download={downloadDecisionAction} label="Tải PDF" />
                  ) : d.file.status === "blocked" ? (
                    <span className="text-danger">Tệp bị chặn vì không an toàn</span>
                  ) : (
                    <span className="text-amber">Đang quét virus</span>
                  )}
                </p>
                <Link href={`/so/giay-chung-nhan?decisionId=${d.id}`} className="w-fit text-brand">
                  Giấy chứng nhận của quyết định →
                </Link>
                <AmendDecisionForm decisionId={d.id} number={d.number} signedOn={d.signedOn} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
