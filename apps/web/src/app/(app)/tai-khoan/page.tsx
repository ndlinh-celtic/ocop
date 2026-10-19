import Link from "next/link";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const actor = await requireActor();
  const mine = await app().core.identity.myAssignments(actor);
  const totpEnabled = await app().core.identity.hasTotp(actor);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Tài khoản</h1>
      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <p className="font-medium">{actor.fullName}</p>
        <p className="text-sm text-text-2">{actor.email}</p>
      </section>
      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="mb-2 font-medium">Vai trò</h2>
        <ul className="text-sm">
          {mine.map((a) => (
            <li key={a.id}>
              {a.roleLabel} · {a.scopeLabel} {a.current && <span className="text-brand">(đang dùng)</span>}
            </li>
          ))}
          {mine.length === 0 && <li className="text-text-2">Chưa có vai trò nào.</li>}
        </ul>
      </section>
      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="mb-2 font-medium">Xác thực hai lớp</h2>
        {totpEnabled ? (
          <p className="text-sm text-brand">Đã bật.</p>
        ) : (
          <p className="text-sm text-text-2">
            Chưa bật.{" "}
            <Link href="/dang-ky-totp" className="font-medium text-brand underline">
              Bật xác thực hai lớp
            </Link>
          </p>
        )}
      </section>
      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-medium">Đổi mật khẩu</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
