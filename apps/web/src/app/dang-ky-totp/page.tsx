import { DomainError } from "@ocop/core";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { CodeForm } from "@/components/code-form";
import { app } from "@/server/app";
import { requestContext } from "@/server/request";
import { sessionToken } from "@/server/session";
import { confirmEnrollmentAction } from "./actions";

export const dynamic = "force-dynamic";

/** TOTP enrolment: forced right after the password step, or opted into from a full session. */
export default async function TotpEnrollmentPage() {
  const token = await sessionToken();
  if (!token) redirect("/dang-nhap");
  let enrollment: { secret: string; otpauthUri: string };
  try {
    enrollment = await app().core.identity.startTotpEnrollment(token, await requestContext());
  } catch (err) {
    if (err instanceof DomainError && err.code === "totp_already_enabled") redirect("/");
    redirect("/dang-nhap");
  }
  const qr = await QRCode.toDataURL(enrollment.otpauthUri, { margin: 1, width: 220 });
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Bật xác thực hai lớp</h1>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-text-2">
          <li>Cài ứng dụng xác thực (Google Authenticator, Microsoft Authenticator…).</li>
          <li>Quét mã QR dưới đây, hoặc nhập khóa thủ công.</li>
          <li>Nhập mã 6 số ứng dụng hiển thị.</li>
        </ol>
        <img src={qr} alt="Mã QR đăng ký xác thực hai lớp" width={220} height={220} className="mx-auto mb-3" />
        <p className="mb-6 break-all text-center font-mono text-sm" data-testid="totp-secret">
          {enrollment.secret}
        </p>
        <CodeForm action={confirmEnrollmentAction} submitLabel="Bật xác thực hai lớp" />
      </div>
    </main>
  );
}
