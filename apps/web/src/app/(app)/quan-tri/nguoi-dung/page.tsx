import { ROLE_LABEL } from "@ocop/core";
import Link from "next/link";
import { formatVnTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { resendActivationAction } from "./actions";
import { CreateUserForm } from "./create-user-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { pending_activation: "Chưa kích hoạt", active: "Đang hoạt động" } as const;

export default async function UsersPage() {
  const actor = await requireActor();
  const users = await app().core.identity.listUsers(actor);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Người dùng</h1>
      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-3 font-medium">Thêm cán bộ</h2>
        <CreateUserForm />
      </section>
      <section className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-4 py-2">Họ tên</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Vai trò</th>
              <th className="px-4 py-2">Trạng thái</th>
              <th className="px-4 py-2">2FA</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/quan-tri/nguoi-dung/${u.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                    {u.fullName}
                  </Link>
                </td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  {u.assignments
                    .filter((a) => a.active)
                    .map((a) => `${ROLE_LABEL[a.role]} (${a.scopeLabel})`)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-2">{u.lockedUntil ? `Tạm khóa đến ${formatVnTime(u.lockedUntil)}` : STATUS_LABEL[u.status]}</td>
                <td className="px-4 py-2">{u.totpEnabled ? "Đã bật" : "Chưa"}</td>
                <td className="px-4 py-2 text-right">
                  {u.status === "pending_activation" && (
                    <form action={resendActivationAction.bind(null, u.id)}>
                      <button type="submit" className="rounded-lg border px-3 py-1">
                        Gửi lại email kích hoạt
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
