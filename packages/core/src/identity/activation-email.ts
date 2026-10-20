import { auditEntry } from "../audit/audit";
import type { ConsumerContext } from "../platform/consumer-context";
import { sendEmail } from "../platform/send-email";
import { hashToken, newToken } from "../shared/tokens";
import { ACTIVATION_TTL_MS } from "./tokens";

/**
 * Issues the activation link when the email is sent, so the raw token never sits in the outbox.
 * Earlier unused links of the user are voided first.
 */
export async function issueActivationLink(c: ConsumerContext): Promise<void> {
  const { deps, tx, event } = c;
  if (event.type !== "identity.user.created" && event.type !== "identity.activation.requested") return;
  const user = await tx.users.findById(event.payload.userId);
  if (!user || user.status !== "pending_activation") return;
  const now = deps.clock.now();
  await tx.oneTimeTokens.invalidateOpen(user.id, "activation", now);
  const token = newToken();
  const tokenId = deps.ids.next();
  const expiresAt = new Date(now.getTime() + ACTIVATION_TTL_MS);
  await tx.oneTimeTokens.insert({
    id: tokenId,
    userId: user.id,
    purpose: "activation",
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt,
    usedAt: null,
    invalidatedAt: null,
  });
  const system = { kind: "system" as const, name: c.consumer, ctx: { requestId: event.id } };
  await tx.audit.append(
    auditEntry(system, deps.ids.next(), now, { action: "identity.activation.issued", targetType: "user", targetId: user.id, metadata: { tokenId, expiresAt } }),
  );
  const link = new URL(`/kich-hoat?token=${token}`, deps.settings.appBaseUrl).toString();
  await sendEmail(c, { to: user.email, template: "activation", data: { fullName: user.fullName, link, expiresAt } });
}
