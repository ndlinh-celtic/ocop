import { EXTENDABLE_DEADLINE_LABEL, type DeadlineExtensionView } from "@ocop/core";
import { formatVnDate, formatVnDateTime } from "@/lib/format";

/** L07: the Gia hạn đợt history of a round, newest first. */
export function ExtensionHistory({ extensions }: { extensions: DeadlineExtensionView[] }) {
  return (
    <section className="rounded-lg border bg-surface p-4">
      <h2 className="mb-3 font-medium">Lịch sử gia hạn</h2>
      {extensions.length === 0 ? (
        <p className="text-sm text-text-2">Đợt chưa được gia hạn lần nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-3">
              <tr>
                <th className="py-2 pr-4 font-medium">Thời điểm</th>
                <th className="py-2 pr-4 font-medium">Mốc hạn</th>
                <th className="py-2 pr-4 font-medium">Hạn cũ</th>
                <th className="py-2 pr-4 font-medium">Hạn mới</th>
                <th className="py-2 pr-4 font-medium">Lý do</th>
                <th className="py-2 font-medium">Người gia hạn</th>
              </tr>
            </thead>
            <tbody>
              {extensions.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatVnDateTime(e.extendedAt)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{EXTENDABLE_DEADLINE_LABEL[e.deadline]}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatVnDate(e.previousDeadline)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatVnDate(e.newDeadline)}</td>
                  <td className="py-2 pr-4 whitespace-pre-line">{e.reason}</td>
                  <td className="py-2">{e.extendedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
