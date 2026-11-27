import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";

type Raw<T> = { [K in keyof T]: unknown };

/**
 * One Cấu hình chung toàn hệ thống that Quản trị edits in the app (as opposed to the deployment settings of
 * `deps.settings`), declared by the module that uses it: which stored key holds each field, its defaults, how a value is
 * checked, and the audit action of a change.
 */
export interface SettingSpec<T extends object> {
  /** The stored key of each field. A key never set reads as the field's default. */
  keys: { [K in keyof T]: string };
  defaults: T;
  /** The value in force, from what is stored or submitted; refuses an invalid one with a DomainError. */
  normalize(raw: Raw<T>): T;
  /** The audit action of a change, such as `system.reminder_milestones_changed`. */
  auditAction: string;
}

export interface Setting<T extends object> {
  /** The value in force, inside a use case's transaction. */
  readIn(tx: Tx): Promise<T>;
  /** Use case: Quản trị reads the value in force. */
  read(deps: CoreDeps): (actor: Actor) => Promise<T>;
  /**
   * Use case: Quản trị sets it for the whole system, audited with the value before and after, and one
   * `system.setting_changed` event per key. What is computed afterwards uses it; what was issued before keeps its own.
   */
  write(deps: CoreDeps): (actor: Actor, input: Raw<T>) => Promise<T>;
}

export function defineSetting<T extends object>(spec: SettingSpec<T>): Setting<T> {
  const fields = Object.keys(spec.keys) as (keyof T & string)[];

  async function readIn(tx: Tx): Promise<T> {
    const raw = {} as Raw<T>;
    for (const field of fields) {
      const stored = await tx.systemSettings.get(spec.keys[field]);
      raw[field] = stored === null || stored === undefined ? spec.defaults[field] : stored;
    }
    return spec.normalize(raw);
  }

  return {
    readIn,
    read: (deps) => async (actor) => {
      authorize(actor, "system.settings.manage");
      return deps.uow.run((tx) => readIn(tx));
    },
    write: (deps) => async (actor, input) => {
      authorize(actor, "system.settings.manage");
      const after = spec.normalize(input);
      return deps.uow.run(async (tx) => {
        const before = await readIn(tx);
        const now = deps.clock.now();
        for (const field of fields) await tx.systemSettings.put(spec.keys[field], after[field], now, actor.userId);
        await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: spec.auditAction, targetType: "system_setting", before, after }));
        for (const field of fields) await emit(deps, tx, { type: "system.setting_changed", payload: { key: spec.keys[field] } });
        return after;
      });
    },
  };
}
