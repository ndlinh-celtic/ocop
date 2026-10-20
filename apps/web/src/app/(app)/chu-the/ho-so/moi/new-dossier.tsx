import type { UserActor } from "@ocop/core";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { SetPicker } from "./set-picker";

/**
 * S13 Tạo hồ sơ (L02 CT-03, stories 15 to 17): the Bộ tiêu chí of the Phiên bản tiêu chí that applies now.
 * `tu` makes it Sao chép sang hồ sơ mới from that hồ sơ (story 27). Under Nhập hộ (L01) `actor` acts for
 * Chủ thể `onBehalf`.
 */
export async function NewDossier({ actor, tu, onBehalf, back }: { actor: UserActor; tu?: string; onBehalf?: string; back: ReactNode }) {
  const source = tu ? await app().core.dossiers.get(actor, { dossierId: tu }).catch(orNotFound) : undefined;
  if (source === null) notFound();
  let options;
  try {
    options = await app().core.dossiers.creationOptions(actor);
  } catch (err) {
    return <p role="alert" className="rounded-lg border bg-surface p-4 text-sm text-danger">{domainMessage(err)}</p>;
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        {back}
        <h1 className="mt-1 text-xl font-semibold">{source ? "Sao chép sang hồ sơ mới" : "Tạo hồ sơ"}</h1>
        <p className="text-sm text-text-2">
          {options.round ? `Theo ${options.round.name}, ` : "Hiện không có đợt đang nhận nộp, "}
          Phiên bản tiêu chí {options.version.legalBasis}.
        </p>
        {source && (
          <p className="mt-2 text-sm text-text-2">
            Hồ sơ mới chép thông tin sản phẩm và tệp minh chứng (vào kho, chưa gắn tiêu chí) từ hồ sơ <b>{source.productName || "chưa đặt tên"}</b>. Điểm tự
            chấm và giải trình không được chép.
          </p>
        )}
      </div>
      <SetPicker productGroups={options.productGroups} legalBasis={options.version.legalBasis} sourceId={source?.id} onBehalf={onBehalf} />
    </div>
  );
}
