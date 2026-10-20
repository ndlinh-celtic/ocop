import { redirect } from "next/navigation";
import { CodeForm } from "@/components/code-form";
import { app } from "@/server/app";
import { anonymous } from "@/server/request";
import { sessionToken } from "@/server/session";
import { verifyCodeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TotpStepPage() {
  const token = await sessionToken();
  const pending = token ? await app().core.identity.pendingSignIn(await anonymous(), { sessionToken: token }) : null;
  if (!pending || pending.stage !== "totp_pending") redirect("/dang-nhap");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Xác thực hai lớp</h1>
        <p className="mb-6 text-sm text-text-2">Mở ứng dụng xác thực và nhập mã cho {pending.email}.</p>
        <CodeForm action={verifyCodeAction} submitLabel="Xác nhận" />
      </div>
    </main>
  );
}
