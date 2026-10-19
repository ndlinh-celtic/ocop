import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { markAllReadAction, markReadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const items = await app().core.notifications.list(await requireActor());
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Thông báo</h1>
        {items.some((n) => !n.readAt) && (
          <form action={markAllReadAction}>
            <button className="rounded-lg border px-3 py-1 text-sm">Đánh dấu tất cả đã đọc</button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border bg-white p-6 text-center text-gray-500">Chưa có thông báo nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-2xl border bg-white p-4 ${n.readAt ? "opacity-70" : "border-green-600"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-gray-600">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-500">{formatVnDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <form action={markReadAction.bind(null, n.id)}>
                    <button className="rounded-lg border px-3 py-1 text-sm">Đã đọc</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
