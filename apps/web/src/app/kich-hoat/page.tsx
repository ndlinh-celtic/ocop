import { app } from "@/server/app";
import { ActivateForm } from "./activate-form";

export const dynamic = "force-dynamic";

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const who = token ? await app().core.identity.describeActivation(token) : null;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Kích hoạt tài khoản</h1>
        {who && token ? (
          <>
            <p className="mb-6 text-sm text-gray-600">
              {who.fullName} · {who.email}
            </p>
            <ActivateForm token={token} />
          </>
        ) : (
          <p role="alert" className="text-sm text-red-600">
            Liên kết không còn hiệu lực. Liên hệ Quản trị để được gửi lại.
          </p>
        )}
      </div>
    </main>
  );
}
