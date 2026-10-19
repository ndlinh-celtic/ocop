import { DEFAULT_ALLOWED_TYPES, type FileStatus } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { DownloadButton } from "./download-button";
import { RefreshWhileScanning } from "./refresh-while-scanning";
import { Uploader } from "./uploader";

export const dynamic = "force-dynamic";

const STATUS: Record<FileStatus, string> = {
  awaiting_upload: "Chưa tải xong",
  scanning: "Đang quét",
  clean: "Sạch",
  blocked: "Bị chặn",
};

const accept = Object.entries(DEFAULT_ALLOWED_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)])
  .join(",");

const size = (n: number) => (n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default async function TestUploadPage() {
  const files = await app().core.files.list(await requireActor());
  return (
    <div className="flex flex-col gap-6">
      <RefreshWhileScanning active={files.some((f) => f.status === "scanning")} />
      <h1 className="text-xl font-semibold">Thử tải tệp</h1>
      <p className="text-sm text-text-2">
        Kiểm tra đường tải tệp thẳng lên kho lưu trữ, quét mã độc trong vùng cách ly, và tải xuống bằng liên kết có thời hạn.
      </p>
      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <Uploader accept={accept} />
      </section>
      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-4 py-2">Tệp</th>
              <th className="px-4 py-2">Dung lượng</th>
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2">Thời điểm</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id} className="border-b last:border-0" data-testid="file-row">
                <td className="px-4 py-2">{f.fileName}</td>
                <td className="px-4 py-2">{size(f.size)}</td>
                <td className="px-4 py-2" data-testid="file-status">
                  {STATUS[f.status]}
                  {f.blockReason && <span className="block text-xs text-danger">{f.blockReason}</span>}
                </td>
                <td className="px-4 py-2">{formatVnDateTime(f.createdAt)}</td>
                <td className="px-4 py-2 text-right">{f.status === "clean" && <DownloadButton fileId={f.id} />}</td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-text-3">
                  Chưa có tệp nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
