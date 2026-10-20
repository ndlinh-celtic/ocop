import Link from "next/link";
import { redirect } from "next/navigation";
import { app } from "@/server/app";
import { currentActor } from "@/server/session";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

/** S02: Chủ thể self-registration (L01 CT-01). The password is set from the activation email. */
export default async function RegisterPage() {
  if (await currentActor()) redirect("/");
  const wards = await app().core.org.listWards();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-lg border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Đăng ký tài khoản chủ thể</h1>
        <p className="mb-6 text-sm text-text-2">Dành cho doanh nghiệp, hợp tác xã và hộ sản xuất muốn tham gia đánh giá OCOP.</p>
        <RegisterForm wards={wards.map((w) => ({ id: w.id, name: w.name }))} />
        <p className="mt-4 text-center text-sm text-text-3">
          Đã có tài khoản?{" "}
          <Link href="/dang-nhap" className="text-brand">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
