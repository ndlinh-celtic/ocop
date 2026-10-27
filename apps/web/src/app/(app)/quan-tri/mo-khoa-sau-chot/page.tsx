import { DOSSIER_STATE_LABEL } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

const METHOD = { totp: "TOTP", password: "mật khẩu" } as const;

/**
 * L15 Mở khóa sau chốt (spec #49 stories 127 to 132): Quản trị's page of its own, on no menu. It finds a hồ sơ by mã
 * and shows only its mã, state and earlier Mở khóa; nothing of the hồ sơ or its điểm.
 */
export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const actor = await requireActor();
  const { ma = "" } = await searchParams;
  const target = ma.trim() ? await app().core.scoring.unlockTarget(actor, { code: ma }).catch(orNotFound) : undefined;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Mở khóa sau chốt</h1>
      <p className="text-sm text-text-2">
        Xử lý sự cố khi cần sửa điểm của hồ sơ Đã chốt điểm, theo văn bản yêu cầu của Hội đồng. Mọi thao tác được ghi nhật ký.
      </p>
      <form method="get" className="flex gap-2">
        <input
          name="ma"
          defaultValue={ma}
          placeholder="Mã hồ sơ, ví dụ HS-2026-0001"
          aria-label="Mã hồ sơ"
          className="flex-1 rounded-md border border-line-strong bg-surface px-3 py-2"
        />
        <button type="submit" className="rounded-md border border-line-strong px-4 py-2">
          Tra cứu
        </button>
      </form>
      {target === null && <p className="text-sm text-danger">Không tìm thấy hồ sơ có mã này.</p>}
      {target && (
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
          <p>
            Hồ sơ <span className="font-semibold">{target.code}</span>: {DOSSIER_STATE_LABEL[target.state]}
          </p>
          {target.state === "score_finalized" ? (
            <UnlockForm dossierId={target.dossierId} code={target.code} />
          ) : (
            <p className="text-sm text-text-2">Chỉ Mở khóa được hồ sơ Đã chốt điểm.</p>
          )}
          {target.unlocks.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <h2 className="font-medium">Các lần Mở khóa</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {target.unlocks.map((u) => (
                  <li key={u.id}>
                    {formatVnDateTime(u.unlockedAt)}, kết quả lần {u.n} bị thay thế. Người yêu cầu: {u.requestedBy}. Lý do: {u.reason}. Thực hiện:{" "}
                    {u.unlockedBy.fullName} (xác thực lại bằng {METHOD[u.reauthMethod]}).
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
