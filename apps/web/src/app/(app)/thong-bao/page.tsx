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
        <p className="rounded-lg border bg-surface p-6 text-center text-text-3">Chưa có thông báo nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-lg border bg-surface p-4 ${n.readAt ? "opacity-70" : "border-brand"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-text-2">{n.body}</p>
                  <p className="mt-1 text-xs text-text-3">{formatVnDateTime(n.createdAt)}</p>
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
