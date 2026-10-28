import { isAssignmentActive, type User } from "../identity/model";
import type { Role, ScopeType } from "../identity/roles";
import type { ConsumerContext } from "../platform/consumer-context";
import { sendEmailOnce } from "../platform/send-email";
import type { Tx } from "../shared/uow";
import { wardOfficersOf } from "./ward";

/*
 * Story 86: who hears about what happens to a hồ sơ, in the app and by email. Each notice is worked out
 * from the event, then delivered by two consumers, so that a failing SMTP server retries the email
 * without repeating the in-app notification.
 */

interface Notice {
  recipients: User[];
  kind: string;
  /** In-app title and body; they may name the product and the Chủ thể. */
  title: string;
  body: string;
  /** Emails carry a link only, never business data (L23): a fixed subject and line. */
  emailSubject: string;
  emailLine: string;
  /** Path within the app. */
  link: string;
}

type IdlessScope = "province" | "system";

/** The active Người dùng holding a Phân vai of `role` on one Phạm vi, active at `now`, each once. */
async function activeHolders(tx: Tx, role: Role, scopeType: IdlessScope, scopeId: null, now: Date): Promise<User[]>;
async function activeHolders(tx: Tx, role: Role, scopeType: Exclude<ScopeType, IdlessScope>, scopeId: string, now: Date): Promise<User[]>;
async function activeHolders(tx: Tx, role: Role, scopeType: ScopeType, scopeId: string | null, now: Date): Promise<User[]> {
  const all =
    scopeId === null
      ? await tx.roleAssignments.listForScope(role, scopeType as IdlessScope, null)
      : await tx.roleAssignments.listForScope(role, scopeType as Exclude<ScopeType, IdlessScope>, scopeId);
  const userIds = new Set(all.filter((a) => isAssignmentActive(a, now)).map((a) => a.userId));
  const users = await Promise.all([...userIds].map((id) => tx.users.findById(id)));
  return users.filter((u): u is User => u !== null && u.status === "active");
}

/** The active Chủ tịch and Thư ký of a Hội đồng, once each. */
async function councilLeaders(tx: Tx, councilId: string, now: Date): Promise<User[]> {
  const users = [
    ...(await activeHolders(tx, "council_chair", "council", councilId, now)),
    ...(await activeHolders(tx, "council_secretary", "council", councilId, now)),
  ];
  return [...new Map(users.map((u) => [u.id, u])).values()];
}

/** The Người dùng holding an active Phân vai Chủ thể on the Chủ thể. */
export function entityUsers(tx: Tx, entityId: string, now: Date): Promise<User[]> {
  return activeHolders(tx, "entity_owner", "entity", entityId, now);
}

/** The events of a hồ sơ someone hears about; the consumers of platform/consumers.ts subscribe to these. */
export const NOTICE_EVENTS = [
  "dossier.submitted",
  "dossier.received",
  "dossier.handler_changed",
  "dossier.rejected_preliminary",
  "dossier.ward_transferred",
  "dossier.round_transferred",
  "dossier.supplement_requested",
  "dossier.resubmitted",
  "dossier.closed_unsupplemented",
  "dossier.forwarded",
  "dossier.returned_by_province",
  "dossier.return_requested",
  "dossier.grading_started",
  "dossier.advisory_report_issued",
  "dossier.advisory_copied",
  "dossier.members_confirmed",
  "dossier.score_finalized",
  "scoring.score_sheet_returned",
  "council.assignment.replaced",
  "council.assignment.added",
  "dossier.advisory_return_requested",
  "dossier.unlocked",
  "dossier.result_published",
  "dossier.five_star_closed",
] as const;

async function noticesOf({ deps, tx, event }: ConsumerContext): Promise<Notice[]> {
  if (!(NOTICE_EVENTS as readonly string[]).includes(event.type) || !("dossierId" in event.payload)) return [];
  const now = deps.clock.now();
  // The consumer reads on behalf of the Chủ thể the event names.
  const scope = { kind: "entity", entityId: event.payload.entityId } as const;
  const dossier = await tx.dossiers.findById(scope, event.payload.dossierId);
  if (!dossier) return [];
  const product = dossier.productName || "chưa đặt tên";
  const ownerLink = `/chu-the/ho-so/${dossier.id}`;
  const wardLink = `/xa/ho-so/${dossier.id}`;
  /**
   * Those of `userIds` still Cán bộ xã of the hồ sơ's xã; when none is, every Cán bộ xã of the xã, so
   * that the xã always hears of it.
   */
  const xaOfficers = async (userIds: (string | null)[]): Promise<User[]> => {
    if (!dossier.wardId) return [];
    const officers = await wardOfficersOf(tx, dossier.wardId, now);
    const named = officers.filter((u) => userIds.includes(u.id));
    return named.length > 0 ? named : officers;
  };
  // L05 XA-02, XA-03 (story 41): the Cán bộ phụ trách hears of it when someone else names them.
  const handlerAssigned = async (): Promise<Notice[]> => {
    const named = dossier.handlerUserId;
    const actorUserId = "actorUserId" in event.payload ? event.payload.actorUserId : undefined;
    if (!named || named === actorUserId) return [];
    const handler = await tx.users.findById(named);
    if (handler?.status !== "active") return [];
    return [
      {
        recipients: [handler],
        kind: "dossier_handler_assigned",
        title: `Anh/chị là Cán bộ phụ trách hồ sơ: ${product}`,
        body: "Anh/chị được chỉ định làm Cán bộ phụ trách hồ sơ này.",
        emailSubject: "Anh/chị được chỉ định làm Cán bộ phụ trách hồ sơ OCOP",
        emailLine: "Anh/chị vừa được chỉ định làm Cán bộ phụ trách một hồ sơ OCOP của xã/phường.",
        link: wardLink,
      },
    ];
  };

  switch (event.type) {
    case "dossier.submitted": {
      if (!dossier.wardId) return [];
      const entity = await tx.entities.findById(scope, dossier.entityId);
      return [
        {
          recipients: await wardOfficersOf(tx, dossier.wardId, now),
          kind: "dossier_submitted",
          title: `Hồ sơ mới nộp: ${product}`,
          body: `${entity?.name ?? "Một Chủ thể"} đã nộp hồ sơ về xã, đang chờ tiếp nhận.`,
          emailSubject: "Hồ sơ mới nộp chờ tiếp nhận",
          emailLine: "Một Chủ thể vừa nộp hồ sơ OCOP về xã/phường của anh/chị. Hồ sơ đang chờ tiếp nhận.",
          link: wardLink,
        },
      ];
    }
    case "dossier.received":
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_received",
          title: `Hồ sơ ${product} đã được tiếp nhận`,
          body: "UBND xã/phường đã tiếp nhận hồ sơ và chỉ định cán bộ phụ trách.",
          emailSubject: "Hồ sơ OCOP đã được tiếp nhận",
          emailLine: "UBND xã/phường đã tiếp nhận hồ sơ OCOP của anh/chị.",
          link: ownerLink,
        },
        ...(await handlerAssigned()),
      ];
    case "dossier.handler_changed":
      return handlerAssigned();
    case "dossier.rejected_preliminary":
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_rejected_preliminary",
          title: `Hồ sơ ${product} không đạt sơ bộ`,
          body: "UBND xã/phường đã loại hồ sơ ở bước đánh giá sơ bộ. Xem lý do loại trong hồ sơ.",
          emailSubject: "Hồ sơ OCOP Không đạt sơ bộ",
          emailLine: "Hồ sơ OCOP của anh/chị Không đạt sơ bộ. Lý do loại có trong hồ sơ trên hệ thống.",
          link: ownerLink,
        },
      ];
    case "dossier.ward_transferred": {
      if (!dossier.wardId) return [];
      const entity = await tx.entities.findById(scope, dossier.entityId);
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_ward_transferred",
          title: `Hồ sơ ${product} đã được chuyển xã`,
          body: "Hồ sơ đã được chuyển sang xã/phường đúng địa bàn, đang chờ xã/phường đó tiếp nhận.",
          emailSubject: "Hồ sơ OCOP đã được chuyển xã/phường",
          emailLine: "Hồ sơ OCOP của anh/chị đã được chuyển sang xã/phường đúng địa bàn để tiếp nhận.",
          link: ownerLink,
        },
        {
          recipients: await wardOfficersOf(tx, dossier.wardId, now),
          kind: "dossier_ward_transferred_in",
          title: `Hồ sơ chuyển đến: ${product}`,
          body: `Hồ sơ của ${entity?.name ?? "một Chủ thể"} được chuyển đến xã, đang chờ tiếp nhận.`,
          emailSubject: "Hồ sơ chuyển đến chờ tiếp nhận",
          emailLine: "Một hồ sơ OCOP vừa được chuyển đến xã/phường của anh/chị. Hồ sơ đang chờ tiếp nhận.",
          link: wardLink,
        },
      ];
    }
    // L06 XA-08 (story 69): chuyển đợt tells the Chủ thể its hồ sơ will be considered in a later đợt.
    case "dossier.round_transferred":
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_round_transferred",
          title: `Hồ sơ ${product} đã được chuyển đợt`,
          body: "UBND xã/phường đã chuyển hồ sơ sang đợt đánh giá sau. Xem lý do chuyển trong dòng thời gian của hồ sơ.",
          emailSubject: "Hồ sơ OCOP đã được chuyển đợt",
          emailLine: "Hồ sơ OCOP của anh/chị đã được chuyển sang đợt đánh giá sau.",
          link: ownerLink,
        },
      ];
    case "dossier.supplement_requested":
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_supplement_requested",
          title: `Hồ sơ ${product} cần bổ sung`,
          body: "UBND xã/phường yêu cầu bổ sung hồ sơ. Xem từng nội dung cần bổ sung và hạn bổ sung.",
          emailSubject: "Hồ sơ OCOP có yêu cầu bổ sung",
          emailLine: "UBND xã/phường có yêu cầu bổ sung hồ sơ OCOP của anh/chị. Vui lòng bổ sung và nộp lại trước hạn.",
          link: ownerLink,
        },
      ];
    case "dossier.resubmitted": {
      // Who asked for more, and the Cán bộ phụ trách (story 54), each once. After a Sở trả về the hồ sơ is
      // back with the xã to review (story 58), so only the xã hears of it.
      // Whoever of them no longer works at the xã is replaced by every Cán bộ xã of the xã.
      const request = (await tx.supplements.list(dossier.id)).filter((r) => r.outcome === "resubmitted").at(-1);
      const asker = request?.requestedRole === "ward_officer" ? request.requestedBy : null;
      const entity = await tx.entities.findById(scope, dossier.entityId);
      return [
        {
          recipients: await xaOfficers([asker, dossier.handlerUserId]),
          kind: "dossier_resubmitted",
          title: `Hồ sơ nộp lại: ${product}`,
          body: `${entity?.name ?? "Chủ thể"} đã bổ sung và nộp lại hồ sơ.`,
          emailSubject: "Hồ sơ OCOP đã được nộp lại",
          emailLine: "Một Chủ thể vừa bổ sung và nộp lại hồ sơ OCOP anh/chị đang xử lý.",
          link: wardLink,
        },
      ];
    }
    case "dossier.closed_unsupplemented":
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_rejected_preliminary",
          title: `Hồ sơ ${product} không đạt sơ bộ`,
          body: "Hồ sơ đã quá hạn bổ sung nên UBND xã/phường đóng hồ sơ với lý do: Không bổ sung.",
          emailSubject: "Hồ sơ OCOP Không đạt sơ bộ",
          emailLine: "Hồ sơ OCOP của anh/chị đã quá hạn bổ sung và được đóng ở trạng thái Không đạt sơ bộ.",
          link: ownerLink,
        },
      ];
    // L06 XA-07 (story 67): gửi tỉnh tells the Sở, which now receives it, and the Chủ thể.
    case "dossier.forwarded": {
      const entity = await tx.entities.findById(scope, dossier.entityId);
      return [
        {
          recipients: await provinceOfficers(tx, now),
          kind: "dossier_forwarded",
          title: `Hồ sơ gửi tỉnh: ${product}`,
          body: `UBND xã/phường đã gửi tỉnh hồ sơ của ${entity?.name ?? "một Chủ thể"}.`,
          emailSubject: "Có hồ sơ OCOP mới gửi tỉnh",
          emailLine: "UBND xã/phường vừa gửi tỉnh một hồ sơ OCOP.",
          link: `/so/ho-so/${dossier.id}`,
        },
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_forwarded",
          title: `Hồ sơ ${product} đã được gửi tỉnh`,
          body: "UBND xã/phường đã đánh giá sơ bộ và gửi hồ sơ lên Sở Nông nghiệp và Môi trường.",
          emailSubject: "Hồ sơ OCOP đã được gửi tỉnh",
          emailLine: "UBND xã/phường đã gửi hồ sơ OCOP của anh/chị lên tỉnh.",
          link: ownerLink,
        },
      ];
    }
    // L04 (stories 42, 57): the Sở trả về; the Chủ thể has to bổ sung, and the Cán bộ phụ trách will
    // review the nộp lại.
    case "dossier.returned_by_province": {
      const xa = await xaOfficers([dossier.handlerUserId]);
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_returned_by_province",
          title: `Hồ sơ ${product} được Sở trả về để bổ sung`,
          body: "Sở Nông nghiệp và Môi trường trả hồ sơ về để bổ sung. Xem từng nội dung cần bổ sung và hạn bổ sung.",
          emailSubject: "Hồ sơ OCOP được Sở trả về để bổ sung",
          emailLine: "Sở Nông nghiệp và Môi trường trả hồ sơ OCOP của anh/chị về để bổ sung. Vui lòng bổ sung và nộp lại trước hạn.",
          link: ownerLink,
        },
        {
          recipients: xa,
          kind: "dossier_returned_by_province",
          title: `Sở trả về hồ sơ: ${product}`,
          body: "Sở trả hồ sơ về Yêu cầu bổ sung. Sau khi Chủ thể nộp lại, hồ sơ về Đã nộp xã để xã xem lại và gửi tỉnh lại.",
          emailSubject: "Sở trả về một hồ sơ OCOP",
          emailLine: "Sở Nông nghiệp và Môi trường vừa trả về một hồ sơ OCOP anh/chị phụ trách.",
          link: wardLink,
        },
      ];
    }
    // L04 (stories 59, 86): the Sở hears of a đề nghị trả về; the lý do is read in the app.
    case "dossier.return_requested":
      return [
        {
          recipients: await provinceOfficers(tx, now),
          kind: "dossier_return_requested",
          title: `Xã đề nghị trả về hồ sơ: ${product}`,
          body: "UBND xã/phường đề nghị Sở trả về một hồ sơ đã gửi tỉnh. Xem lý do trong hồ sơ.",
          emailSubject: "Có đề nghị trả về hồ sơ OCOP",
          emailLine: "UBND xã/phường vừa đề nghị Sở trả về một hồ sơ OCOP đã gửi tỉnh.",
          link: `/so/ho-so/${dossier.id}`,
        },
      ];
    // L10 TM-03 (#57 story 52): the Sở hears of a đề nghị trả về of the Tổ tư vấn; the lý do is read in the app.
    case "dossier.advisory_return_requested":
      return [
        {
          recipients: await provinceOfficers(tx, now),
          kind: "dossier_advisory_return_requested",
          title: `Tổ tư vấn đề nghị trả về hồ sơ: ${product}`,
          body: `Tổ tư vấn đề nghị Sở trả hồ sơ ${dossier.code} về xã để bổ sung. Xem lý do trong hồ sơ.`,
          emailSubject: "Tổ tư vấn đề nghị trả về một hồ sơ OCOP",
          emailLine: "Tổ tư vấn Hội đồng vừa đề nghị Sở trả về xã một hồ sơ OCOP đang thẩm định.",
          link: `/so/ho-so/${dossier.id}`,
        },
      ];
    // L09 HD-06 (story 40): Giao chấm tells everyone whose Phân công is in force, each with a link to their list.
    case "dossier.grading_started": {
      const inForce = (await tx.assignments.current(dossier.id)).filter((a) => a.effectiveAt !== null);
      const usersOf = async (kind: "member" | "advisory") => {
        const users = await Promise.all(inForce.filter((a) => a.kind === kind).map((a) => tx.users.findById(a.userId)));
        return users.filter((u): u is User => u?.status === "active");
      };
      const notice = (recipients: User[], role: string, link: string): Notice => ({
        recipients,
        kind: "dossier_grading_started",
        title: `Hồ sơ được Giao chấm: ${product}`,
        body: `Anh/chị được Phân công ${role} hồ sơ ${dossier.code}.`,
        emailSubject: "Anh/chị được Giao chấm một hồ sơ OCOP",
        emailLine: `Anh/chị vừa được Phân công ${role} một hồ sơ OCOP của Hội đồng.`,
        link,
      });
      return [
        notice(await usersOf("advisory"), "thẩm định (Tổ tư vấn)", "/to-tu-van/hang-doi"),
        notice(await usersOf("member"), "chấm điểm", "/thanh-vien/ho-so"),
      ];
    }
    // L09 HD-03 (stories 38, 39): the person replaced loses the hồ sơ, so their notice names only its mã;
    // the newcomer hears like a Giao chấm.
    case "council.assignment.replaced":
    case "council.assignment.added": {
      const { kind, replacedUserId, newUserId } = event.payload;
      const active = async (id: string | null) => {
        const u = id ? await tx.users.findById(id) : null;
        return u?.status === "active" ? [u] : [];
      };
      const role = kind === "advisory" ? "thẩm định (Tổ tư vấn)" : "chấm điểm";
      return [
        {
          recipients: await active(replacedUserId),
          kind: "dossier_assignment_replaced",
          title: `Anh/chị không còn phụ trách hồ sơ ${dossier.code}`,
          body: `Thư ký hội đồng đã thay người ${role} hồ sơ ${dossier.code}. Anh/chị không còn xem được hồ sơ này.`,
          emailSubject: "Anh/chị không còn phụ trách một hồ sơ OCOP",
          emailLine: "Thư ký hội đồng đã thay anh/chị khỏi Phân công một hồ sơ OCOP.",
          link: kind === "advisory" ? "/to-tu-van/hang-doi" : "/thanh-vien/ho-so",
        },
        {
          recipients: await active(newUserId),
          kind: "dossier_assigned",
          title: `Anh/chị được Phân công hồ sơ: ${product}`,
          body: `Anh/chị được Phân công ${role} hồ sơ ${dossier.code}.`,
          emailSubject: "Anh/chị được Phân công một hồ sơ OCOP",
          emailLine: `Anh/chị vừa được Phân công ${role} một hồ sơ OCOP của Hội đồng.`,
          link: kind === "advisory" ? "/to-tu-van/hang-doi" : `/thanh-vien/ho-so/${dossier.id}`,
        },
      ];
    }
    // L11 (story 62): each phiên bản issued tells the thành viên chấm whose Phân công is in force.
    case "dossier.advisory_report_issued": {
      const members = (await tx.assignments.current(dossier.id)).filter((a) => a.effectiveAt !== null && a.kind === "member");
      const users = (await Promise.all(members.map((a) => tx.users.findById(a.userId)))).filter((u): u is User => u?.status === "active");
      return [
        {
          recipients: users,
          kind: "dossier_advisory_report_issued",
          title: `Có báo cáo Tổ tư vấn mới: ${product}`,
          body: `Tổ tư vấn đã phát hành báo cáo cho hồ sơ ${dossier.code}.`,
          emailSubject: "Có báo cáo Tổ tư vấn mới",
          emailLine: "Tổ tư vấn vừa phát hành báo cáo cho một hồ sơ OCOP anh/chị được Phân công chấm.",
          link: `/thanh-vien/ho-so/${dossier.id}/bao-cao-to-tu-van`,
        },
      ];
    }
    // L12 (story 75): a sao chép tells the thành viên chấm it wrote a dòng for, as copyAdvisory named them.
    case "dossier.advisory_copied": {
      const ids = "recipientUserIds" in event.payload ? (event.payload.recipientUserIds ?? []) : [];
      const users = (await Promise.all(ids.map((id) => tx.users.findById(id)))).filter((u): u is User => u?.status === "active");
      return [
        {
          recipients: users,
          kind: "dossier_advisory_copied",
          title: `Phiếu chấm đã được điền sẵn: ${product}`,
          body: `Tổ tư vấn đã sao chép Điểm đề xuất vào Phiếu chấm của anh/chị cho hồ sơ ${dossier.code}.`,
          emailSubject: "Phiếu chấm OCOP của anh/chị đã được điền sẵn",
          emailLine: "Tổ tư vấn vừa sao chép Điểm đề xuất vào Phiếu chấm của anh/chị cho một hồ sơ OCOP.",
          link: `/thanh-vien/ho-so/${dossier.id}`,
        },
      ];
    }
    // L15 Mở khóa sau chốt (story 130): the Chủ tịch and Thư ký Trả phiếu and chốt again; the lý do stays in the audit.
    case "dossier.unlocked": {
      if (!dossier.councilId) return [];
      return [
        {
          recipients: await councilLeaders(tx, dossier.councilId, now),
          kind: "dossier_unlocked",
          title: `Hồ sơ được Mở khóa sau chốt: ${product}`,
          body: `Hồ sơ ${dossier.code} đã được Mở khóa sau chốt theo văn bản yêu cầu của Hội đồng; kết quả chốt cũ bị thay thế. Trả phiếu cho người cần chấm lại rồi chốt lại trong một Phiên họp mới.`,
          emailSubject: "Một hồ sơ OCOP được Mở khóa sau chốt",
          emailLine: "Một hồ sơ OCOP của Hội đồng đã được Mở khóa sau chốt và cần chốt lại.",
          link: `/hoi-dong/chot-diem/${dossier.id}`,
        },
      ];
    }
    // L15 (story 96): Sẵn sàng chốt, for the Chủ tịch and Thư ký of the Hội đồng.
    case "dossier.members_confirmed": {
      if (!dossier.councilId) return [];
      return [
        {
          recipients: await councilLeaders(tx, dossier.councilId, now),
          kind: "dossier_members_confirmed",
          title: `Hồ sơ Sẵn sàng chốt: ${product}`,
          body: `Hồ sơ ${dossier.code} đã đủ số phiếu đã xác nhận theo Quy tắc tổng hợp.`,
          emailSubject: "Một hồ sơ OCOP đã Sẵn sàng chốt",
          emailLine: "Một hồ sơ OCOP của Hội đồng đã đủ số phiếu đã xác nhận để đưa vào Phiên họp.",
          link: "/hoi-dong/tien-do",
        },
      ];
    }
    // L15 HD-08 (story 121): chốt điểm, for the thành viên chấm and the Tổ tư vấn whose Phân công is in force.
    case "dossier.score_finalized": {
      const inForce = (await tx.assignments.current(dossier.id)).filter((a) => a.effectiveAt !== null);
      const usersOf = async (kind: "member" | "advisory") =>
        (await Promise.all(inForce.filter((a) => a.kind === kind).map((a) => tx.users.findById(a.userId)))).filter((u): u is User => u?.status === "active");
      const notice = (recipients: User[], link: string): Notice => ({
        recipients,
        kind: "dossier_score_finalized",
        title: `Hồ sơ đã chốt điểm: ${product}`,
        body: `Hội đồng đã chốt điểm hồ sơ ${dossier.code}.`,
        emailSubject: "Một hồ sơ OCOP đã được chốt điểm",
        emailLine: "Hội đồng vừa chốt điểm một hồ sơ OCOP anh/chị được Phân công.",
        link,
      });
      return [notice(await usersOf("member"), `/thanh-vien/diem-tong-hop/${dossier.id}`), notice(await usersOf("advisory"), `/to-tu-van/ho-so/${dossier.id}`)];
    }
    // L15 HD-05 (story 103): the thành viên given their phiếu back hears why in the app; the email has only a link.
    case "scoring.score_sheet_returned": {
      const user = await tx.users.findById(event.payload.userId);
      return [
        {
          recipients: user?.status === "active" ? [user] : [],
          kind: "dossier_score_sheet_returned",
          title: `Phiếu chấm được Trả phiếu: ${product}`,
          body: `Hội đồng Trả phiếu của anh/chị cho hồ sơ ${dossier.code} để chấm lại. Lý do: ${event.payload.reason}`,
          emailSubject: "Phiếu chấm của anh/chị được Trả phiếu",
          emailLine: "Hội đồng vừa Trả phiếu chấm của anh/chị cho một hồ sơ OCOP để chấm lại.",
          link: `/thanh-vien/ho-so/${dossier.id}`,
        },
      ];
    }
    // L16 CT-13 (#83, spec #79 story 63): Công bố kết quả, to the Chủ thể; what the kết quả is shows only in the app.
    case "dossier.result_published": {
      const outcome = event.payload.outcome;
      const body =
        outcome === "recognized"
          ? `Hồ sơ ${dossier.code} đã được công nhận sản phẩm OCOP. Xem điểm, hạng và nhận xét của Hội đồng trong hồ sơ.`
          : outcome === "five_star_proposal"
            ? `Hồ sơ ${dossier.code} đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao. Xem điểm và nhận xét của Hội đồng trong hồ sơ.`
            : `Hồ sơ ${dossier.code} đã có kết quả đánh giá. Xem kết quả trong hồ sơ.`;
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_result_published",
          title: `Hồ sơ đã có kết quả: ${product}`,
          body,
          emailSubject: "Hồ sơ OCOP đã có kết quả",
          emailLine: "Hồ sơ OCOP của anh/chị đã có kết quả đánh giá, phân hạng. Đăng nhập để xem kết quả.",
          link: ownerLink,
        },
      ];
    }
    // L17 SO-04 (#87, spec #79 story 58): đóng hồ sơ with Bộ công nhận 5 sao, to the Chủ thể; kết quả khác tells no one.
    case "dossier.five_star_closed": {
      if ((await tx.fiveStar.closureOf(dossier.id))?.outcome !== "ministry_recognized_5_star") return [];
      return [
        {
          recipients: await entityUsers(tx, dossier.entityId, now),
          kind: "dossier_five_star_recognized",
          title: `Sản phẩm được Bộ công nhận 5 sao: ${product}`,
          body: `Hồ sơ ${dossier.code} đã được Bộ Nông nghiệp và Môi trường công nhận sản phẩm OCOP 5 sao.`,
          emailSubject: "Hồ sơ OCOP được Bộ công nhận 5 sao",
          emailLine: "Hồ sơ OCOP của anh/chị đã có kết quả đánh giá 5 sao của Trung ương. Đăng nhập để xem chi tiết.",
          link: ownerLink,
        },
      ];
    }
    default:
      return [];
  }
}

/** The Người dùng holding an active Phân vai Cán bộ Sở (Phạm vi tỉnh). */
function provinceOfficers(tx: Tx, now: Date): Promise<User[]> {
  return activeHolders(tx, "province_officer", "province", null, now);
}

/** In-app side of the notices on a hồ sơ. */
export async function notifyDossierEvent(c: ConsumerContext): Promise<void> {
  for (const notice of await noticesOf(c)) {
    for (const user of notice.recipients) {
      await c.tx.notifications.insert({
        id: c.deps.ids.next(),
        userId: user.id,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        link: notice.link,
        createdAt: c.deps.clock.now(),
        readAt: null,
      });
    }
  }
}

/** Email side of the notices on a hồ sơ. */
export async function emailDossierEvent(c: ConsumerContext): Promise<void> {
  for (const notice of await noticesOf(c)) {
    for (const user of notice.recipients) {
      await sendEmailOnce(c, {
        to: user.email,
        template: "dossier_notice",
        data: {
          fullName: user.fullName,
          subject: notice.emailSubject,
          line: notice.emailLine,
          link: new URL(notice.link, c.deps.settings.appBaseUrl).toString(),
        },
      });
    }
  }
}
