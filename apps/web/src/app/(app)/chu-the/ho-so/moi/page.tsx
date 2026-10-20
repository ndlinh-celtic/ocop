import Link from "next/link";
import { notFound } from "next/navigation";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import { SetPicker } from "./set-picker";

export const dynamic = "force-dynamic";

/**
 * S13 Tạo hồ sơ (L02 CT-03, stories 15 to 17): the Bộ tiêu chí of the Phiên bản tiêu chí that applies now.
 * `?tu=<id>` makes it Sao chép sang hồ sơ mới from that hồ sơ (story 27).
 */
export default async function NewDossierPage({ searchParams }: { searchParams: Promise<{ tu?: string }> }) {
  const actor = await requireActor();
  const { tu } = await searchParams;
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
        <Link href="/chu-the/ho-so" className="text-sm text-brand">
          ← Hồ sơ của tôi
        </Link>
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
      <SetPicker productGroups={options.productGroups} legalBasis={options.version.legalBasis} sourceId={source?.id} />
    </div>
  );
}
