import { redirect } from "next/navigation";
import { currentActor } from "@/server/session";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await currentActor()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Đăng nhập</h1>
        <p className="mb-6 text-sm text-text-2">Hệ thống đánh giá, phân hạng sản phẩm OCOP</p>
        <SignInForm />
      </div>
    </main>
  );
}
