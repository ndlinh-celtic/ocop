import { isTemplateKind, TEMPLATE_VARIABLES, type TemplateVariable } from "@ocop/core";
import { Download, FlaskConical } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ActivateButton } from "./activate-button";
import { TemplateUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

const link = "inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs hover:bg-surface-2";

function FileLinks({ kind, version }: { kind: string; version: string }) {
  const href = `/quan-tri/mau-van-ban/${kind}/tep/${version}`;
  return (
    <span className="flex flex-wrap gap-2">
      <a href={href} className={link}>
        <Download className="size-3" aria-hidden /> Tải về
      </a>
      <a href={`${href}?sinh-thu`} className={link}>
        <FlaskConical className="size-3" aria-hidden /> Sinh thử
      </a>
    </span>
  );
}

function VariableRows({ vars, depth = 0 }: { vars: readonly TemplateVariable[]; depth?: number }) {
  return vars.flatMap((v) => [
    <tr key={`${depth}-${v.name}`} className="border-t border-line">
      <td className="px-4 py-2 font-mono text-xs" style={{ paddingLeft: `${1 + depth * 1.5}rem` }}>
        {v.children ? `{#${v.name}} … {/${v.name}}` : `{${v.name}}`}
      </td>
      <td className="px-4 py-2">{v.label}</td>
      <td className="px-4 py-2">{v.required ? "Bắt buộc" : ""}</td>
    </tr>,
    ...(v.children ? [<VariableRows key={`${depth}-${v.name}-children`} vars={v.children} depth={depth + 1} />] : []),
  ]);
}

/** #82 stories 71 to 77: the phiên bản of one loại văn bản, its variables, and the upload of a new phiên bản. */
export default async function TemplateKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isTemplateKind(kind)) notFound();
  const actor = await requireActor();
  const view = (await app().core.documents.listTemplates(actor)).find((k) => k.kind === kind);
  if (!view) notFound();
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <nav className="text-sm text-text-3">
        <Link href="/quan-tri/mau-van-ban" className="hover:underline">
          Mẫu văn bản
        </Link>{" "}
        / {view.label}
      </nav>
      <h1 className="text-xl font-semibold">{view.label}</h1>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="font-medium">Phiên bản mẫu</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-text-2">
              <tr>
                <th className="px-4 py-2 font-medium">Phiên bản</th>
                <th className="px-4 py-2 font-medium">Tải lên</th>
                <th className="px-4 py-2 font-medium">Tệp</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {view.versions.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    Phiên bản {v.n}
                    {v.active && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">Đang dùng</span>}
                  </td>
                  <td className="px-4 py-2">
                    {formatVnDateTime(v.uploadedAt)}, {v.uploadedByName}
                  </td>
                  <td className="px-4 py-2">{v.fileName}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <FileLinks kind={kind} version={v.id} />
                      {!v.active && <ActivateButton kind={kind} versionId={v.id} label="Dùng phiên bản này" />}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="px-4 py-2">
                  Mẫu mặc định
                  {view.activeVersionId === null && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">Đang dùng</span>}
                </td>
                <td className="px-4 py-2 text-text-3">Đóng gói sẵn trong phần mềm</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <FileLinks kind={kind} version="mac-dinh" />
                    {view.activeVersionId !== null && <ActivateButton kind={kind} versionId="" label="Quay về mẫu mặc định" />}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="font-medium">Tải lên phiên bản mới</h2>
        <TemplateUploadForm kind={kind} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="font-medium">Danh sách biến</h2>
        <p className="text-sm text-text-2">
          Giữ nguyên tên biến, kể cả ngoặc nhọn; được di chuyển, định dạng lại hoặc bỏ biến không bắt buộc. Biến con chỉ dùng được giữa thẻ mở và thẻ đóng của
          vòng lặp, mỗi dòng của vòng lặp lặp lại một lần.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-text-2">
              <tr>
                <th className="px-4 py-2 font-medium">Biến</th>
                <th className="px-4 py-2 font-medium">Mô tả</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              <VariableRows vars={TEMPLATE_VARIABLES[kind]} />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
