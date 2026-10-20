import { DomainError, ROLE_LABEL } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatVnDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { revokeRoleAction } from "./actions";
import { GrantRoleForm } from "./grant-form";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const [user, wards] = await Promise.all([
    app()
      .core.identity.getUser(actor, { userId: id })
      .catch((err: unknown) => (err instanceof DomainError && err.code === "user_not_found" ? null : Promise.reject(err))),
    app().core.org.listWards(),
  ]);
  if (!user) notFound();
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/quan-tri/nguoi-dung">Người dùng</Link> / {user.fullName}
      </nav>
      <h1 className="text-xl font-semibold">{user.fullName}</h1>
      <p className="text-sm text-text-2">{user.email}</p>
      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-3 font-medium">Gán vai trò</h2>
        <GrantRoleForm userId={user.id} wards={wards} />
      </section>
      <section className="rounded-lg border bg-surface">
        <h2 className="border-b px-4 py-3 font-medium">Phân vai</h2>
        {user.assignments.length === 0 ? (
          <p className="p-4 text-sm text-text-3">Chưa có phân vai nào.</p>
        ) : (
          <ul>
            {user.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
                <div>
                  <p className="font-medium">
                    {ROLE_LABEL[a.role]} · {a.scopeLabel}
                  </p>
                  <p className="text-xs text-text-3">
                    {formatVnDate(a.validFrom)} – {a.validTo ? formatVnDate(a.validTo) : "không thời hạn"} · {a.active ? "Đang hiệu lực" : "Không hiệu lực"}
                  </p>
                </div>
                {(a.validTo === null || a.validTo > new Date()) && (
                  <form action={revokeRoleAction.bind(null, user.id, a.id)}>
                    <button className="rounded-lg border border-danger px-3 py-1 text-sm text-danger">Thu hồi</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
