/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { EmailMessage } from "@ocop/core";
import { render } from "@react-email/render";
import { ActivationEmail } from "./templates/activation";
import { AccountLockedEmail } from "./templates/account-locked";
import { PasswordResetEmail } from "./templates/password-reset";
import { RoleGrantedEmail } from "./templates/role-granted";
import { DossierNoticeEmail } from "./templates/dossier-notice";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const vnTime = (d: Date) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(d);

export async function renderEmail(message: EmailMessage): Promise<RenderedEmail> {
  switch (message.template) {
    case "activation": {
      const el = <ActivationEmail fullName={message.data.fullName} link={message.data.link} expiresAtText={vnTime(message.data.expiresAt)} />;
      return { subject: "Kích hoạt tài khoản OCOP", html: await render(el), text: await render(el, { plainText: true }) };
    }
    case "role_granted": {
      const el = <RoleGrantedEmail {...message.data} />;
      return { subject: `Thông báo phân vai: ${message.data.roleLabel}`, html: await render(el), text: await render(el, { plainText: true }) };
    }
    case "account_locked": {
      const el = <AccountLockedEmail fullName={message.data.fullName} untilText={vnTime(message.data.until)} resetLink={message.data.resetLink} />;
      return { subject: "Tài khoản OCOP bị tạm khóa", html: await render(el), text: await render(el, { plainText: true }) };
    }
    case "password_reset": {
      const el = <PasswordResetEmail fullName={message.data.fullName} link={message.data.link} expiresAtText={vnTime(message.data.expiresAt)} />;
      return { subject: "Đặt lại mật khẩu OCOP", html: await render(el), text: await render(el, { plainText: true }) };
    }
    case "dossier_notice": {
      const el = <DossierNoticeEmail {...message.data} />;
      return { subject: message.data.subject, html: await render(el), text: await render(el, { plainText: true }) };
    }
  }
}
