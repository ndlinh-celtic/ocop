import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/server/session";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "het-han": "Phiên đăng nhập đã hết hạn. Đăng nhập lại.",
  "tam-khoa": "Tài khoản tạm khóa do nhập sai nhiều lần. Kiểm tra email để biết thời gian mở khóa.",
  "dat-lai": "Đã đặt mật khẩu mới. Đăng nhập lại.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentActor()) redirect("/");
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => params[k] !== undefined);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Đăng nhập</h1>
        <p className="mb-6 text-sm text-text-2">Hệ thống đánh giá, phân hạng sản phẩm OCOP</p>
        {notice && (
          <p role="status" className="mb-4 rounded-md bg-brand-soft p-3 text-sm">
            {NOTICES[notice]}
          </p>
        )}
        <SignInForm />
        <Link href="/quen-mat-khau" className="mt-4 block text-center text-sm text-brand">
          Quên mật khẩu?
        </Link>
        <Link href="/dang-ky" className="mt-4 block rounded-lg border border-line-strong px-4 py-2 text-center text-sm font-medium">
          Đăng ký tài khoản chủ thể
        </Link>
      </div>
    </main>
  );
}
