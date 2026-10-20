"use server";

import { ENTITY_KINDS } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { anonymous } from "@/server/request";

export interface RegisterState {
  error?: string;
  /** What was typed, so a refused form keeps it. */
  values?: Record<string, string>;
  /** Set once registered: the address the activation link went to. */
  sentTo?: string;
}

const text = z.string().trim().min(1);
const input = z.object({
  kind: z.enum(ENTITY_KINDS),
  name: text,
  identifier: text,
  wardId: text,
  address: text,
  representativeName: text,
  phone: text,
  email: text,
  agree: z.literal("on"),
});

/** L01 CT-01 (S02): a visitor registers a Chủ thể; the account is activated from the emailed link. */
export async function registerAction(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const values = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const parsed = input.safeParse(values);
  if (!parsed.success) {
    const agreed = values.agree === "on";
    return { values, error: agreed ? "Điền đủ các trường bắt buộc" : "Cần đồng ý điều khoản và chính sách dữ liệu cá nhân để tạo tài khoản" };
  }
  const { agree: _agree, ...data } = parsed.data;
  try {
    await app().core.entities.register(await anonymous(), data);
  } catch (err) {
    return { values, error: domainMessage(err) };
  }
  return { sentTo: data.email };
}
