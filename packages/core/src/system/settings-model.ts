/**
 * Cấu hình chung toàn hệ thống that Quản trị edits in the app, as opposed to the deployment settings of
 * `deps.settings`. One JSON value per key; a key never set reads as its default.
 */
export interface SystemSettingRepo {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, at: Date, by: string): Promise<void>;
}
