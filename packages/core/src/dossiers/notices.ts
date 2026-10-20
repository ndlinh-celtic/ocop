import { isAssignmentActive, type User } from "../identity/model";
import type { ConsumerContext } from "../platform/consumer-context";
import { sendEmail } from "../platform/send-email";
import type { Tx } from "../shared/uow";
import type { DossierEventType } from "./transitions";
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
async function entityUsers(tx: Tx, entityId: string, now: Date): Promise<User[]> {
  const assignments = (await tx.roleAssignments.listForScope("entity_owner", "entity", entityId)).filter((a) => isAssignmentActive(a, now));
  const users = await Promise.all([...new Set(assignments.map((a) => a.userId))].map((id) => tx.users.findById(id)));
  return users.filter((u): u is User => u !== null && u.status === "active");
}

/** The events of a hồ sơ someone hears about; the consumers subscribe to exactly these. */
export const NOTICE_EVENTS = [
  "dossier.submitted",
  "dossier.received",
  "dossier.supplement_requested",
  "dossier.resubmitted",
  "dossier.closed_unsupplemented",
] as const satisfies readonly DossierEventType[];

type Event = ConsumerContext["event"];
const isNoticeEvent = (e: Event): e is Extract<Event, { type: DossierEventType }> => (NOTICE_EVENTS as readonly string[]).includes(e.type);

async function noticeOf({ deps, tx, event }: ConsumerContext): Promise<Notice | null> {
  if (!isNoticeEvent(event)) return null;
  const now = deps.clock.now();
  // The consumer reads on behalf of the Chủ thể the event names.
  const scope = { kind: "entity", entityId: event.payload.entityId } as const;
  const dossier = await tx.dossiers.findById(scope, event.payload.dossierId);
  if (!dossier) return null;
  const product = dossier.productName || "chưa đặt tên";

  if (event.type === "dossier.submitted") {
    if (!dossier.wardId) return null;
    const entity = await tx.entities.findById(scope, dossier.entityId);
    return {
      recipients: await wardOfficersOf(tx, dossier.wardId, now),
      kind: "dossier_submitted",
      title: `Hồ sơ mới nộp: ${product}`,
      body: `${entity?.name ?? "Một Chủ thể"} đã nộp hồ sơ về xã, đang chờ tiếp nhận.`,
      emailSubject: "Hồ sơ mới nộp chờ tiếp nhận",
      emailLine: "Một Chủ thể vừa nộp hồ sơ OCOP về xã/phường của anh/chị. Hồ sơ đang chờ tiếp nhận.",
      link: `/xa/ho-so/${dossier.id}`,
    };
  }
  if (event.type === "dossier.supplement_requested") {
    return {
      recipients: await entityUsers(tx, dossier.entityId, now),
      kind: "dossier_supplement_requested",
      title: `Hồ sơ ${product} cần bổ sung`,
      body: "UBND xã/phường yêu cầu bổ sung hồ sơ. Xem từng nội dung cần bổ sung và hạn bổ sung.",
      emailSubject: "Hồ sơ OCOP có yêu cầu bổ sung",
      emailLine: "UBND xã/phường có yêu cầu bổ sung hồ sơ OCOP của anh/chị. Vui lòng bổ sung và nộp lại trước hạn.",
      link: `/chu-the/ho-so/${dossier.id}`,
    };
  }
  if (event.type === "dossier.resubmitted") {
    // Who asked for more, and the Cán bộ phụ trách (story 54), each once.
    const request = (await tx.supplements.list(dossier.id)).filter((r) => r.outcome === "resubmitted").at(-1);
    const ids = [...new Set([request?.requestedBy, dossier.handlerUserId].filter((id): id is string => !!id))];
    const users = await Promise.all(ids.map((id) => tx.users.findById(id)));
    const entity = await tx.entities.findById(scope, dossier.entityId);
    return {
      recipients: users.filter((u): u is User => u !== null && u.status === "active"),
      kind: "dossier_resubmitted",
      title: `Hồ sơ nộp lại: ${product}`,
      body: `${entity?.name ?? "Chủ thể"} đã bổ sung và nộp lại hồ sơ.`,
      emailSubject: "Hồ sơ OCOP đã được nộp lại",
      emailLine: "Một Chủ thể vừa bổ sung và nộp lại hồ sơ OCOP anh/chị đang xử lý.",
      link: `/xa/ho-so/${dossier.id}`,
    };
  }
  if (event.type === "dossier.closed_unsupplemented") {
    return {
      recipients: await entityUsers(tx, dossier.entityId, now),
      kind: "dossier_rejected",
      title: `Hồ sơ ${product} không đạt sơ bộ`,
      body: "Hồ sơ đã quá hạn bổ sung nên UBND xã/phường đóng hồ sơ với lý do: Không bổ sung.",
      emailSubject: "Hồ sơ OCOP không đạt sơ bộ",
      emailLine: "Hồ sơ OCOP của anh/chị đã quá hạn bổ sung và được đóng ở trạng thái Không đạt sơ bộ.",
      link: `/chu-the/ho-so/${dossier.id}`,
    };
  }
  return {
    recipients: await entityUsers(tx, dossier.entityId, now),
    kind: "dossier_received",
    title: `Hồ sơ ${product} đã được tiếp nhận`,
    body: "UBND xã/phường đã tiếp nhận hồ sơ và chỉ định cán bộ phụ trách.",
    emailSubject: "Hồ sơ OCOP đã được tiếp nhận",
    emailLine: "UBND xã/phường đã tiếp nhận hồ sơ OCOP của anh/chị.",
    link: `/chu-the/ho-so/${dossier.id}`,
  };
}

/** In-app side of the notices on a hồ sơ. */
export async function notifyDossierEvent(c: ConsumerContext): Promise<void> {
  const notice = await noticeOf(c);
  if (!notice) return;
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

/** Email side of the notices on a hồ sơ. */
export async function emailDossierEvent(c: ConsumerContext): Promise<void> {
  const notice = await noticeOf(c);
  if (!notice) return;
  for (const user of notice.recipients) {
    await sendEmail(c, {
      to: user.email,
      template: "dossier_notice",
      data: { fullName: user.fullName, subject: notice.emailSubject, line: notice.emailLine, link: new URL(notice.link, c.deps.settings.appBaseUrl).toString() },
    });
  }
}
