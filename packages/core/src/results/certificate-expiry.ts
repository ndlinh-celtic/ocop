import { auditEntry } from "../audit/audit";
import { entityUsers, provinceOfficers } from "../dossiers/notices";
import { expiryDeadline } from "../dossiers/reminder-model";
import { vnDaysUntil } from "../dossiers/reminders";
import type { User } from "../identity/model";
import type { ConsumerContext } from "../platform/consumer-context";
import { emit } from "../platform/emit";
import { sendEmailOnce } from "../platform/send-email";
import { vnDateOf } from "../rounds/model";
import type { SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { formatDayVn } from "../shared/format";
import { certificateSettingsIn } from "../system/settings";
import { certificateExpiry } from "./certificate-model";

/*
 * L16 nhắc Giấy chứng nhận sắp hết hiệu lực (#86, spec #79 stories 32, 33, 35). One mốc: `certificate.expiry_reminder_months`
 * (6 by default) calendar months before the ngày hết hiệu lực. From that day until the giấy expires, the daily job reminds
 * its Chủ thể and the Cán bộ Sở once, through the reminder ledger (kind certificate_expiry, context the giấy). A giấy
 * whose ngày hết hiệu lực is recomputed (its quyết định's ngày ký corrected) before its reminder is reminded by the new
 * date; once reminded it is never reminded again, even if the date moves later.
 */

const DAY_MS = 86_400_000;

/** The day (YYYY-MM-DD) a giấy expiring on `expiresOn` is reminded, `months` before it. */
export const expiryReminderDay = (expiresOn: string, months: number): string => certificateExpiry(expiresOn, -months);

/** The worker job, daily. A system use case: no `authorize`. */
export function sendCertificateExpiryReminders(deps: CoreDeps) {
  return (actor: SystemActor): Promise<{ sent: number }> =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const today = vnDateOf(now);
      const { expiryReminderMonths } = await certificateSettingsIn(tx);
      let sent = 0;
      for (const c of await tx.reminders.unremindedCertificates(today)) {
        const remindOn = expiryReminderDay(c.expiresOn, expiryReminderMonths);
        if (remindOn > today) continue;
        const deadline = expiryDeadline(c.expiresOn);
        const milestoneDays = Math.round((Date.parse(c.expiresOn) - Date.parse(remindOn)) / DAY_MS);
        const recorded = await tx.reminders.record({
          kind: "certificate_expiry",
          subjectId: c.entityId,
          contextId: c.certificateId,
          deadline,
          milestoneDays,
          sentAt: now,
        });
        if (!recorded) continue;
        const daysLeft = vnDaysUntil(deadline, now);
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "results.certificate_expiry_reminded",
            targetType: "certificate",
            targetId: c.certificateId,
            metadata: { dossierId: c.dossierId, expiresOn: c.expiresOn, milestoneDays, daysLeft },
          }),
        );
        await emit(deps, tx, {
          type: "certificate.expiry_due",
          payload: { certificateId: c.certificateId, dossierId: c.dossierId, entityId: c.entityId, expiresOn: c.expiresOn, daysLeft },
        });
        sent++;
      }
      return { sent };
    });
}

interface ExpiryNotice {
  recipients: User[];
  title: string;
  body: string;
  emailLine: string;
  link: string;
}

const EMAIL_SUBJECT = "Nhắc Giấy chứng nhận OCOP sắp hết hiệu lực";

async function noticesOf({ deps, tx, event }: ConsumerContext): Promise<ExpiryNotice[]> {
  if (event.type !== "certificate.expiry_due") return [];
  const p = event.payload;
  const certificate = await tx.certificates.findById(p.certificateId);
  const dossier = await tx.dossiers.findById({ kind: "entity", entityId: p.entityId }, p.dossierId);
  if (!certificate || !dossier) return [];
  const now = deps.clock.now();
  const date = formatDayVn(p.expiresOn);
  const product = dossier.productName || "chưa đặt tên";
  const title = `Giấy chứng nhận ${certificate.code} hết hiệu lực ngày ${date}`;
  const body = `Giấy chứng nhận OCOP ${certificate.recognizedStar} sao của sản phẩm ${product} hết hiệu lực ngày ${date} (còn ${p.daysLeft} ngày).`;
  return [
    {
      recipients: await entityUsers(tx, p.entityId, now),
      title,
      body,
      emailLine: `Giấy chứng nhận sản phẩm OCOP của anh/chị sẽ hết hiệu lực ngày ${date}.`,
      link: `/chu-the/ho-so/${p.dossierId}`,
    },
    {
      recipients: await provinceOfficers(tx, now),
      title,
      body,
      emailLine: `Một Giấy chứng nhận sản phẩm OCOP sẽ hết hiệu lực ngày ${date}.`,
      link: `/so/ho-so/${p.dossierId}`,
    },
  ];
}

/** In-app side of the reminder. */
export async function notifyCertificateExpiry(c: ConsumerContext): Promise<void> {
  for (const notice of await noticesOf(c)) {
    for (const user of notice.recipients) {
      await c.tx.notifications.insert({
        id: c.deps.ids.next(),
        userId: user.id,
        kind: "certificate_expiry",
        title: notice.title,
        body: notice.body,
        link: notice.link,
        createdAt: c.deps.clock.now(),
        readAt: null,
      });
    }
  }
}

/** Email side: a link and a fixed line with the ngày hết hiệu lực, no other business data (L23). */
export async function emailCertificateExpiry(c: ConsumerContext): Promise<void> {
  for (const notice of await noticesOf(c)) {
    for (const user of notice.recipients) {
      await sendEmailOnce(c, {
        to: user.email,
        template: "dossier_notice",
        data: {
          fullName: user.fullName,
          subject: EMAIL_SUBJECT,
          line: notice.emailLine,
          link: new URL(notice.link, c.deps.settings.appBaseUrl).toString(),
        },
      });
    }
  }
}
