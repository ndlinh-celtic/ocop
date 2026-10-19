import Link from "next/link";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-6 shadow-card">
        <h1 className="mb-6 text-xl font-semibold">Đặt lại mật khẩu</h1>
        {token ? (
          <ResetForm token={token} />
        ) : (
          <p role="alert" className="text-sm text-danger">
            Thiếu liên kết. <Link href="/quen-mat-khau" className="text-brand underline">Yêu cầu liên kết mới</Link>
          </p>
        )}
      </div>
    </main>
  );
}
