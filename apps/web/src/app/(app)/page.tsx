import { ROLE_LABEL } from "@ocop/core";
import { Repeat } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { navFor } from "@/lib/nav";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { switchRoleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await requireActor();
  const mine = await app().core.identity.myAssignments(actor);

  if (!actor.activeRole) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Xin chào {actor.fullName}</h1>
        {mine.length === 0 ? (
          <EmptyState icon={Repeat} title="Bạn chưa được phân vai">
            Liên hệ Quản trị để được gán vai trò và phạm vi làm việc.
          </EmptyState>
        ) : (
          <section className="rounded-lg border bg-surface p-4 shadow-card">
            <h2 className="mb-3 font-medium">Chọn vai trò để làm việc</h2>
            <ul className="flex flex-col gap-2">
              {mine.map((a) => (
                <li key={a.id}>
                  <form action={switchRoleAction.bind(null, a.id)}>
                    <button type="submit" className="w-full rounded-md border px-4 py-3 text-left hover:bg-surface-2">
                      <span className="block font-medium">{a.roleLabel}</span>
                      <span className="block text-sm text-text-2">{a.scopeLabel}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const current = mine.find((a) => a.current);
  const tiles = navFor(actor.activeRole).filter((i) => i.href !== "/");
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-gradient-to-br from-[var(--hero-a)] via-[var(--hero-b)] to-[var(--hero-c)] p-6 text-white">
        <p className="text-sm opacity-90">
          {ROLE_LABEL[actor.activeRole]}
          {current ? ` · ${current.scopeLabel}` : ""}
        </p>
        <h1 className="text-2xl font-semibold">Xin chào {actor.fullName}</h1>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg border bg-surface p-4 shadow-card hover:border-brand">
              <span className="grid size-10 place-items-center rounded-md bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{item.label}</span>
                {!item.ready && <span className="block text-xs text-text-3">Có ở phiên bản sau</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
