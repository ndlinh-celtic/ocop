import { can, ROLE_LABEL, type CouncilMember, type CouncilRole } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/download-button";
import { RoundStatusTag } from "@/components/rounds/round-status-tag";
import { formatIsoDate, formatVnDate } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { downloadDecisionAction, setLeaderAction } from "../actions";
import { CouncilForm } from "../council-form";
import { LeaderForm } from "./leader-form";

export const dynamic = "force-dynamic";

function MemberTable({ rows }: { rows: { role: CouncilRole; member: CouncilMember }[] }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-text-3">Chưa có ai. Đề nghị Quản trị cấp Phân vai trên hội đồng này.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-surface-2">
          <tr>
            <th className="px-4 py-2">Họ tên</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Vai trò</th>
            <th className="px-4 py-2">Hiệu lực</th>
            <th className="px-4 py-2">2FA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ role, member: m }) => (
            <tr key={m.assignmentId} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{m.fullName}</td>
              <td className="px-4 py-2">{m.email}</td>
              <td className="px-4 py-2">{ROLE_LABEL[role]}</td>
              <td className="px-4 py-2">
                {formatVnDate(m.validFrom)} – {m.validTo ? formatVnDate(m.validTo) : "không thời hạn"}
              </td>
              <td className="px-4 py-2">
                {m.totpEnabled ? "Đã bật" : <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Chưa bật 2FA</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * S40 (L09 HD-01): one Hội đồng. Its quyết định thành lập and Tổ trưởng, which Cán bộ Sở records; its
 * members by Vai trò, which are the Phân vai in force that Quản trị grants (story 8); and its đợt.
 */
export default async function CouncilPage({ params }: { params: Promise<{ councilId: string }> }) {
  const { councilId } = await params;
  const actor = await requireActor();
  const council = await app().core.councils.get(actor, { councilId }).catch(orNotFound);
  if (!council) notFound();
  const manage = can(actor, "council.manage");
  const board = (["council_chair", "council_secretary", "council_member"] as const).flatMap((role) => council.members[role].map((member) => ({ role, member })));
  const advisory = council.members.advisory_member.map((member) => ({ role: "advisory_member" as const, member }));
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/so/hoi-dong">Hội đồng</Link> / {council.name}
      </nav>
      <h1 className="text-xl font-semibold">{council.name}</h1>
      <section className="rounded-lg border bg-surface p-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-3">Quyết định thành lập</dt>
            <dd className="text-sm font-medium">
              Số {council.decisionNumber}, ngày {formatIsoDate(council.decisionDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-3">Tệp quyết định</dt>
            <dd className="text-sm">
              {council.decisionFile?.status === "clean" ? (
                <DownloadButton fileId={council.id} download={downloadDecisionAction} label={council.decisionFile.fileName} />
              ) : council.decisionFile?.status === "blocked" ? (
                <span className="text-danger">Tệp bị chặn khi quét, hãy tải lên tệp khác</span>
              ) : (
                <span className="text-text-2">Đang quét mã độc…</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-3">Tổ trưởng Tổ tư vấn</dt>
            <dd className="text-sm font-medium">
              {council.leader ? (
                <>
                  {council.leader.fullName}
                  {!council.leader.active && <span className="ml-2 text-xs font-normal text-danger">Phân vai Tổ tư vấn đã hết hiệu lực, cần chỉ định lại</span>}
                </>
              ) : (
                <span className="font-normal text-warning">Chưa chỉ định</span>
              )}
            </dd>
          </div>
        </dl>
      </section>
      {manage && (
        <section className="rounded-lg border bg-surface p-4">
          <h2 className="mb-3 font-medium">Tổ trưởng</h2>
          <LeaderForm
            action={setLeaderAction.bind(null, council.id)}
            advisors={council.members.advisory_member.map((m) => ({ userId: m.userId, fullName: m.fullName }))}
            current={council.leader?.active ? council.leader.userId : null}
          />
        </section>
      )}
      <section className="rounded-lg border bg-surface">
        <h2 className="border-b px-4 py-3 font-medium">Thành viên hội đồng</h2>
        <MemberTable rows={board} />
      </section>
      <section className="rounded-lg border bg-surface">
        <h2 className="border-b px-4 py-3 font-medium">Tổ tư vấn</h2>
        <MemberTable rows={advisory} />
      </section>
      <section className="rounded-lg border bg-surface">
        <h2 className="border-b px-4 py-3 font-medium">Đợt đánh giá</h2>
        {council.rounds.length === 0 ? (
          <p className="p-4 text-sm text-text-3">Chưa gán cho đợt nào. Gán hội đồng ở trang của đợt đánh giá.</p>
        ) : (
          <ul>
            {council.rounds.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
                <Link href={`/so/dot-danh-gia/${r.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                  {r.name}
                </Link>
                <RoundStatusTag status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {manage && (
        <section className="rounded-lg border bg-surface p-4">
          <h2 className="mb-3 font-medium">Sửa thông tin hội đồng</h2>
          <CouncilForm
            council={{
              id: council.id,
              name: council.name,
              decisionNumber: council.decisionNumber,
              decisionDate: council.decisionDate,
              decisionFileId: council.decisionFileId,
              decisionFileName: council.decisionFile?.fileName ?? null,
            }}
          />
        </section>
      )}
    </div>
  );
}
