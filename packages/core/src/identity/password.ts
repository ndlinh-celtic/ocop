import { DomainError } from "../shared/errors";

export const MIN_PASSWORD_LENGTH = 12;

export function assertPasswordAcceptable(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError("password_too_short", `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
  }
}
