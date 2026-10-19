import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-6 shadow-card">
        <h1 className="mb-1 text-xl font-semibold">Quên mật khẩu</h1>
        <p className="mb-6 text-sm text-text-2">Nhập email để nhận liên kết đặt lại mật khẩu.</p>
        <ForgotForm />
        <Link href="/dang-nhap" className="mt-4 block text-center text-sm text-brand">
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}
