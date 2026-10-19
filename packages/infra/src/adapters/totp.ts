import type { TotpService } from "@ocop/core";
import { generateSecret, generateURI, verify } from "otplib";

// Accept the previous and next 30-second step for clock drift between phone and server.
const TOLERANCE_SECONDS = 30;

export const otplibTotp: TotpService = {
  generateSecret: () => generateSecret(),
  keyUri: (label, secret) => {
    const [issuer, account] = label.includes(":") ? label.split(/:(.*)/s) : ["OCOP", label];
    return generateURI({ issuer: issuer!, label: account!, secret });
  },
  async verify(secret, code, at, afterStep) {
    if (!/^\d{6}$/.test(code)) return { valid: false };
    const result = await verify({
      secret,
      token: code,
      epoch: Math.floor(at.getTime() / 1000),
      epochTolerance: TOLERANCE_SECONDS,
      ...(afterStep !== null ? { afterTimeStep: afterStep } : {}),
    });
    return result.valid && "timeStep" in result ? { valid: true, step: Number(result.timeStep) } : { valid: false };
  },
};
