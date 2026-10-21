import { isAssignmentActive, type User } from "../identity/model";
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

/** The Người dùng holding an active Phân vai Chủ thể on the Chủ thể. */
export async function entityUsers(tx: Tx, entityId: string, now: Date): Promise<User[]> {
  const assignments = (await tx.roleAssignments.listForScope("entity_owner", "entity", entityId)).filter((a) => isAssignmentActive(a, now));
  const users = await Promise.all([...new Set(assignments.map((a) => a.userId))].map((id) => tx.users.findById(id)));
  return users.filter((u): u is User => u !== null && u.status === "active");
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
      const request = (await tx.supplements.list(dossier.id)).filter((r) => r.outcome === "resubmitted").at(-1);
      const asker = request?.requestedRole === "ward_officer" ? request.requestedBy : null;
      const ids = [...new Set([asker, dossier.handlerUserId].filter((id): id is string => !!id))];
      const users = await Promise.all(ids.map((id) => tx.users.findById(id)));
      const entity = await tx.entities.findById(scope, dossier.entityId);
      return [
        {
          recipients: users.filter((u): u is User => u !== null && u.status === "active"),
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
      const handler = dossier.handlerUserId ? await tx.users.findById(dossier.handlerUserId) : null;
      const xa = handler?.status === "active" ? [handler] : dossier.wardId ? await wardOfficersOf(tx, dossier.wardId, now) : [];
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
    default:
      return [];
  }
}

/** The Người dùng holding an active Phân vai Cán bộ Sở (Phạm vi tỉnh). */
async function provinceOfficers(tx: Tx, now: Date): Promise<User[]> {
  const assignments = (await tx.roleAssignments.listForScope("province_officer", "province", null)).filter((a) => isAssignmentActive(a, now));
  const users = await Promise.all([...new Set(assignments.map((a) => a.userId))].map((id) => tx.users.findById(id)));
  return users.filter((u): u is User => u !== null && u.status === "active");
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
        data: { fullName: user.fullName, subject: notice.emailSubject, line: notice.emailLine, link: new URL(notice.link, c.deps.settings.appBaseUrl).toString() },
      });
    }
  }
}
