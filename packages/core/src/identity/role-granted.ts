import type { ConsumerContext } from "../platform/consumer-context";
import { sendEmail } from "../platform/send-email";
import { describeGrant } from "./assignments";

/** Email side of "Phân vai đã gán". */
export async function emailRoleGranted(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "identity.role.granted") return;
  const grant = await describeGrant(c.tx, c.event.payload.assignmentId);
  if (!grant) return;
  await sendEmail(c, {
    to: grant.user.email,
    template: "role_granted",
    data: { fullName: grant.user.fullName, roleLabel: grant.roleLabel, scopeLabel: grant.scopeLabel, link: new URL("/", c.deps.settings.appBaseUrl).toString() },
  });
}

/** In-app side of "Phân vai đã gán". */
export async function notifyRoleGranted(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "identity.role.granted") return;
  const grant = await describeGrant(c.tx, c.event.payload.assignmentId);
  if (!grant) return;
  await c.tx.notifications.insert({
    id: c.deps.ids.next(),
    userId: grant.user.id,
    kind: "role_granted",
    title: `Bạn được phân vai ${grant.roleLabel}`,
    body: `Phạm vi: ${grant.scopeLabel}.`,
    link: "/",
    createdAt: c.deps.clock.now(),
    readAt: null,
  });
}
