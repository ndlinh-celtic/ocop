import { ROLE_LABEL, type Role } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { VerifyChainButton } from "./verify-button";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

/** Dates in the form are Vietnam days; [from 00:00, to + 1 day) in UTC. */
const vnDay = (d: string | undefined, plusDays = 0) => (d ? new Date(new Date(`${d}T00:00:00+07:00`).getTime() + plusDays * 86_400_000) : undefined);

const field = "rounded-md border border-line-strong bg-surface px-3 py-2 text-sm";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const actor = await requireActor();
  const users = await app().core.identity.listUsers(actor);
  const byId = new Map(users.map((u) => [u.id, u]));
  const entries = await app().core.audit.search(actor, {
    ...(q.user ? { actorUserId: q.user } : {}),
    ...(q.action ? { action: [q.action] } : {}),
    ...(q.targetType ? { targetType: q.targetType } : {}),
    ...(q.targetId ? { targetId: q.targetId } : {}),
    ...(q.from ? { from: vnDay(q.from) } : {}),
    ...(q.to ? { to: vnDay(q.to, 1) } : {}),
    limit: 200,
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Nhật ký hoạt động</h1>
        <VerifyChainButton />
      </div>
      <form className="grid grid-cols-1 gap-3 rounded-lg border bg-surface p-4 shadow-card sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Người dùng
          <select name="user" defaultValue={q.user ?? ""} className={field}>
            <option value="">Tất cả</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Hành động
          <input name="action" defaultValue={q.action} placeholder="vd. auth.sign_in.failed" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Loại đối tượng
          <input name="targetType" defaultValue={q.targetType} placeholder="user, file, session…" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Mã đối tượng
          <input name="targetId" defaultValue={q.targetId} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Từ ngày
          <input name="from" type="date" defaultValue={q.from} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Đến ngày
          <input name="to" type="date" defaultValue={q.to} className={field} />
        </label>
        <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-ink sm:col-span-3 lg:col-span-6 lg:justify-self-end">
          Lọc
        </button>
      </form>
      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">Thời điểm</th>
              <th className="px-3 py-2">Người thực hiện</th>
              <th className="px-3 py-2">Hành động</th>
              <th className="px-3 py-2">Đối tượng</th>
              <th className="px-3 py-2">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2">{formatVnDateTime(e.occurredAt)}</td>
                <td className="px-3 py-2">
                  {e.actorUserId ? (byId.get(e.actorUserId)?.fullName ?? e.actorUserId) : "—"}
                  {e.actorRole && <span className="block text-xs text-text-3">{ROLE_LABEL[e.actorRole as Role] ?? e.actorRole}</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 text-xs">
                  {e.targetType && (
                    <>
                      {e.targetType}
                      <span className="block break-all text-text-3">{e.targetId}</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  {(Object.keys(e.metadata).length > 0 || e.before != null || e.after != null) && (
                    <details>
                      <summary className="cursor-pointer text-xs text-brand">Xem</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap break-all text-xs">
                        {JSON.stringify({ before: e.before, after: e.after, metadata: e.metadata, ip: e.ip, requestId: e.requestId }, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-3">
                  Không có dòng nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
