import Link from "next/link";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** #82 story 70: every loại văn bản sinh từ mẫu and its mẫu đang dùng. */
export default async function TemplatesPage() {
  const actor = await requireActor();
  const kinds = await app().core.documents.listTemplates(actor);
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Mẫu văn bản</h1>
      <p className="text-sm text-text-2">
        Tải mẫu về, sửa bố cục và câu chữ trong Word mà giữ nguyên các biến trong ngoặc nhọn, rồi tải lên thành phiên bản mới. Văn bản sinh sau đó dùng mẫu đang
        dùng; văn bản đã lưu giữ nguyên mẫu lúc sinh.
      </p>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-4 py-2 font-medium">Loại văn bản</th>
              <th className="px-4 py-2 font-medium">Mẫu đang dùng</th>
              <th className="px-4 py-2 font-medium">Số phiên bản</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => {
              const active = k.versions.find((v) => v.active);
              return (
                <tr key={k.kind} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link href={`/quan-tri/mau-van-ban/${k.kind}`} className="font-medium text-brand hover:underline">
                      {k.label}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{active ? `Phiên bản ${active.n}, tải lên ${formatVnDateTime(active.uploadedAt)}` : "Mẫu mặc định"}</td>
                  <td className="px-4 py-2">{k.versions.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
