import { auditEntry } from "../audit/audit";
import type { User } from "../identity/model";
import type { ConsumerContext } from "../platform/consumer-context";
import { emit } from "../platform/emit";
import { sendEmail } from "../platform/send-email";
import { vnDateOf } from "../rounds/model";
import type { SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import { reminderMilestonesIn } from "../system/settings";
import { entityUsers } from "./notices";
import type { ReminderKind, ReminderTarget, SentReminder } from "./reminder-model";
import { wardOfficersOf } from "./ward";

// L03 CT-12 Nhắc hạn: the job and its two consumers. The three loại hạn are described in reminder-model.ts.

const DAY_MS = 86_400_000;

/** Whole calendar days in Vietnam from `now` to the day of `deadline` (0 on the day itself). */
export function vnDaysUntil(deadline: Date, now: Date): number {
  return Math.round((Date.parse(vnDateOf(deadline)) - Date.parse(vnDateOf(now))) / DAY_MS);
}

/**
 * The mốc a reminder `daysLeft` days before a hạn falls under: the smallest mốc not below it, or null
 * while every mốc is still ahead. A job that first sees a hạn 10 days ahead sends the 14-day mốc only,
 * never the 30-day one late.
 */
function milestoneFor(milestones: readonly number[], daysLeft: number): number | null {
  const reached = milestones.filter((m) => m >= daysLeft);
  return reached.length ? Math.min(...reached) : null;
}

type Candidate = Omit<SentReminder, "milestoneDays" | "sentAt"> & { payload: ReminderTarget };

async function candidates(tx: Tx, now: Date): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const open = await tx.rounds.findOpen();
  if (open && now <= open.submissionDeadline) {
    for (const entityId of await tx.reminders.entitiesWithDraft(open.criteriaVersionId)) {
      out.push({ kind: "submission", subjectId: entityId, contextId: open.id, deadline: open.submissionDeadline, payload: { kind: "submission", roundId: open.id, entityId } });
    }
  }
  for (const s of await tx.reminders.openSupplements(now)) {
    out.push({ kind: "supplement", subjectId: s.entityId, contextId: s.dossierId, deadline: s.deadline, payload: { kind: "supplement", dossierId: s.dossierId, entityId: s.entityId } });
  }
  const running = (await tx.rounds.list()).filter((r) => (r.status === "open_for_submission" || r.status === "submission_closed") && now <= r.forwardingDeadline);
  for (const round of running) {
    for (const w of await tx.reminders.unforwardedByWard(round.id)) {
      out.push({
        kind: "forwarding",
        subjectId: w.wardId,
        contextId: round.id,
        deadline: round.forwardingDeadline,
        payload: { kind: "forwarding", roundId: round.id, wardId: w.wardId, pending: w.count },
      });
    }
  }
  return out;
}

const TARGET_TYPE: Record<ReminderKind, string> = { submission: "entity", supplement: "entity", forwarding: "ward" };

/**
 * The worker job: sends each reminder whose mốc has come, once per (loại hạn, đối tượng, hạn, mốc). The
 * ledger row, the audit row and the dossier.reminder_due event commit together, so a re-run, or a run
 * racing this one, sends nothing twice. A system use case: no `authorize`.
 */
export function sendDueReminders(deps: CoreDeps) {
  return (actor: SystemActor): Promise<{ sent: number }> =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const milestones = await reminderMilestonesIn(tx);
      let sent = 0;
      for (const c of await candidates(tx, now)) {
        const daysLeft = vnDaysUntil(c.deadline, now);
        const milestoneDays = milestoneFor(milestones, daysLeft);
        if (milestoneDays === null) continue;
        const { payload, ...key } = c;
        if (!(await tx.reminders.record({ ...key, milestoneDays, sentAt: now }))) continue;
        const deadline = c.deadline.toISOString();
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "dossier.reminder_sent",
            targetType: TARGET_TYPE[c.kind],
            targetId: c.subjectId,
            metadata: { kind: c.kind, contextId: c.contextId, deadline, milestoneDays, daysLeft },
          }),
        );
        await emit(deps, tx, { type: "dossier.reminder_due", payload: { ...payload, deadline, milestoneDays, daysLeft } });
        sent++;
      }
      return { sent };
    });
}

interface ReminderNotice {
  recipients: User[];
  title: string;
  body: string;
  emailSubject: string;
  emailLine: string;
  link: string;
}

const vnDisplayDate = (iso: string) => vnDateOf(new Date(iso)).split("-").reverse().join("/");
const left = (daysLeft: number) => (daysLeft === 0 ? "hôm nay là hạn" : `còn ${daysLeft} ngày`);
const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function reminderOf({ deps, tx, event }: ConsumerContext): Promise<ReminderNotice | null> {
  if (event.type !== "dossier.reminder_due") return null;
  const p = event.payload;
  const now = deps.clock.now();
  const date = vnDisplayDate(p.deadline);
  switch (p.kind) {
    case "submission": {
      const round = await tx.rounds.findById(p.roundId);
      return {
        recipients: await entityUsers(tx, p.entityId, now),
        title: `${capitalized(left(p.daysLeft))} nộp hồ sơ: Hạn nộp xã ${date}`,
        body: `Anh/chị còn hồ sơ Nháp chưa nộp cho ${round?.name ?? "đợt đánh giá đang mở"}. Hạn nộp xã là ${date}.`,
        emailSubject: "Nhắc Hạn nộp xã hồ sơ OCOP",
        emailLine: `Anh/chị còn hồ sơ OCOP ở trạng thái Nháp chưa nộp; ${left(p.daysLeft)} (Hạn nộp xã ${date}).`,
        link: "/chu-the/ho-so",
      };
    }
    case "supplement": {
      const dossier = await tx.dossiers.findById({ kind: "entity", entityId: p.entityId }, p.dossierId);
      if (!dossier || dossier.state !== "supplement_requested") return null;
      return {
        recipients: await entityUsers(tx, p.entityId, now),
        title: `${capitalized(left(p.daysLeft))} bổ sung hồ sơ ${dossier.productName || "chưa đặt tên"}`,
        body: `Hạn bổ sung là ${date}. Quá hạn mà chưa nộp lại, hồ sơ có thể bị đóng với lý do Không bổ sung.`,
        emailSubject: "Nhắc hạn bổ sung hồ sơ OCOP",
        emailLine: `Hồ sơ OCOP của anh/chị đang chờ bổ sung; ${left(p.daysLeft)} (hạn bổ sung ${date}).`,
        link: `/chu-the/ho-so/${dossier.id}`,
      };
    }
    case "forwarding": {
      const round = await tx.rounds.findById(p.roundId);
      return {
        recipients: await wardOfficersOf(tx, p.wardId, now),
        title: `${capitalized(left(p.daysLeft))} gửi tỉnh: Hạn gửi tỉnh ${date}`,
        body: `Xã còn ${p.pending} hồ sơ của ${round?.name ?? "đợt đánh giá"} chưa gửi tỉnh. Hạn gửi tỉnh là ${date}.`,
        emailSubject: "Nhắc Hạn gửi tỉnh hồ sơ OCOP",
        emailLine: `Xã/phường của anh/chị còn hồ sơ OCOP chưa gửi tỉnh; ${left(p.daysLeft)} (Hạn gửi tỉnh ${date}).`,
        link: "/xa/ho-so",
      };
    }
  }
}

/** In-app side of a reminder. */
export async function notifyReminder(c: ConsumerContext): Promise<void> {
  const notice = await reminderOf(c);
  if (!notice) return;
  for (const user of notice.recipients) {
    await c.tx.notifications.insert({
      id: c.deps.ids.next(),
      userId: user.id,
      kind: "dossier_reminder",
      title: notice.title,
      body: notice.body,
      link: notice.link,
      createdAt: c.deps.clock.now(),
      readAt: null,
    });
  }
}

/** Email side of a reminder: a link and a fixed line, no business data beyond the hạn (L23). */
export async function emailReminder(c: ConsumerContext): Promise<void> {
  const notice = await reminderOf(c);
  if (!notice) return;
  for (const user of notice.recipients) {
    await sendEmail(c, {
      to: user.email,
      template: "dossier_notice",
      data: { fullName: user.fullName, subject: notice.emailSubject, line: notice.emailLine, link: new URL(notice.link, c.deps.settings.appBaseUrl).toString() },
    });
  }
}
