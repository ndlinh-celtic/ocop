import { CERTIFICATE_STATE_LABEL, CERTIFICATE_STATES, type CertificateState } from "@ocop/core";
import Link from "next/link";
import { DownloadButton } from "@/components/download-button";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { formatIsoDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { downloadDraftAction, downloadSignedAction } from "./actions";
import { SignedUpload } from "./signed-upload";

export const dynamic = "force-dynamic";

const isState = (v: string | undefined): v is CertificateState => (CERTIFICATE_STATES as readonly string[]).includes(v ?? "");

/**
 * L16 HD-11 (#84, spec #79 stories 26 to 29, 34): the Giấy chứng nhận the Sở issued, filtered by năm, trạng thái and
 * quyết định; the bản nháp of one giấy or of a whole quyết định (ZIP) to send for ký số, then the signed PDF of each.
 */
export default async function CertificatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const params = await searchParams;
  const year = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : undefined;
  const state = isState(params.state) ? params.state : undefined;
  const decisionId = params.decisionId || undefined;
  const [certificates, meetings] = await Promise.all([
    app().core.results.listCertificates(actor, { year, state, decisionId }),
    app().core.results.meetingsForDecision(actor),
  ]);
  const decisions = meetings.flatMap((m) => (m.decision ? [{ ...m.decision, title: m.title }] : []));
  const generating = certificates.some((c) => c.draft === "generating");

  return (
    <div className="flex flex-col gap-4">
      <RefreshWhileScanning active={generating} />
      <h1 className="text-xl font-semibold">Giấy chứng nhận</h1>

      <form className="flex flex-wrap items-end gap-3 text-sm" aria-label="Lọc giấy chứng nhận">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Năm</span>
          <input
            name="year"
            defaultValue={year ?? ""}
            inputMode="numeric"
            placeholder="2026"
            className="w-24 rounded-md border border-line-strong px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Trạng thái</span>
          <select name="state" defaultValue={state ?? ""} className="rounded-md border border-line-strong px-2 py-1.5">
            <option value="">Tất cả</option>
            {CERTIFICATE_STATES.map((s) => (
              <option key={s} value={s}>
                {CERTIFICATE_STATE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Quyết định</span>
          <select name="decisionId" defaultValue={decisionId ?? ""} className="rounded-md border border-line-strong px-2 py-1.5">
            <option value="">Tất cả</option>
            {decisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} ({formatIsoDate(d.signedOn)})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg border px-3 py-1.5">
          Lọc
        </button>
        {decisionId && certificates.length > 0 && (
          <a href={`/so/giay-chung-nhan/ban-nhap/${decisionId}`} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white">
            Tải bản nháp cả quyết định (ZIP)
          </a>
        )}
      </form>

      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">Số hiệu</th>
              <th className="px-3 py-2">Hồ sơ, sản phẩm</th>
              <th className="px-3 py-2">Chủ thể</th>
              <th className="px-3 py-2">Hạng công nhận</th>
              <th className="px-3 py-2">Ngày cấp</th>
              <th className="px-3 py-2">Hết hiệu lực</th>
              <th className="px-3 py-2">Quyết định</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Tệp</th>
            </tr>
          </thead>
          <tbody>
            {certificates.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-text-3">
                  Chưa có giấy chứng nhận nào.
                </td>
              </tr>
            )}
            {certificates.map((c) => (
              <tr key={c.id} className="border-b align-top last:border-0" data-testid="certificate-row">
                <td className="px-3 py-2 font-mono whitespace-nowrap">{c.code}</td>
                <td className="px-3 py-2">
                  <Link href={`/so/ho-so/${c.dossier.id}`} className="font-mono text-brand">
                    {c.dossier.code}
                  </Link>
                  <div>{c.dossier.productName}</div>
                </td>
                <td className="px-3 py-2">{c.dossier.entityName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.recognizedStar} sao</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatIsoDate(c.issuedOn)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatIsoDate(c.expiresOn)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.decision.number}</td>
                <td className="px-3 py-2 whitespace-nowrap">{CERTIFICATE_STATE_LABEL[c.state]}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-2">
                    {c.draft === "ready" ? (
                      <DownloadButton fileId={c.id} download={downloadDraftAction} label="Bản nháp PDF" />
                    ) : (
                      <span className="text-amber">Bản nháp đang tạo</span>
                    )}
                    {c.signedCount > 0 && <DownloadButton fileId={c.id} download={downloadSignedAction} label={`Bản đã ký (lần ${c.signedCount})`} />}
                    <SignedUpload certificateId={c.id} reupload={c.signedCount > 0} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
