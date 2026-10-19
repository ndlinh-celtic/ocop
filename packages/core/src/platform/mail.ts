/** What to send; the adapter renders the Vietnamese template. Emails carry links, never sensitive data (L23). */
export type EmailMessage =
  | { to: string; template: "activation"; data: { fullName: string; link: string; expiresAt: Date } }
  | { to: string; template: "role_granted"; data: { fullName: string; roleLabel: string; scopeLabel: string; link: string } }
  | { to: string; template: "account_locked"; data: { fullName: string; until: Date; resetLink: string } }
  | { to: string; template: "password_reset"; data: { fullName: string; link: string; expiresAt: Date } };

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export type DeliveryStatus = "sent" | "failed";

export interface EmailDelivery {
  id: string;
  eventId: string | null;
  consumer: string;
  recipient: string;
  template: EmailMessage["template"];
  status: DeliveryStatus;
  error: string | null;
  attemptedAt: Date;
}

export interface EmailDeliveries {
  record(d: EmailDelivery): Promise<void>;
  list(filter: { to?: string; limit?: number }): Promise<EmailDelivery[]>;
}
