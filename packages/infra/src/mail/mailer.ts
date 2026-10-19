import type { Mailer } from "@ocop/core";
import nodemailer from "nodemailer";
import { renderEmail, type RenderedEmail } from "./render";

export interface OutgoingEmail extends RenderedEmail {
  from: string;
  to: string;
}

/** Where rendered emails go: SMTP in every environment (Mailpit locally), memory in tests. */
export interface MailTransport {
  deliver(email: OutgoingEmail): Promise<void>;
}

export function smtpTransport(url: string): MailTransport {
  const transport = nodemailer.createTransport(url);
  return {
    async deliver(e) {
      await transport.sendMail({ from: e.from, to: e.to, subject: e.subject, html: e.html, text: e.text });
    },
  };
}

export function renderingMailer(transport: MailTransport, from: string): Mailer {
  return {
    async send(message) {
      await transport.deliver({ ...(await renderEmail(message)), from, to: message.to });
    },
  };
}
