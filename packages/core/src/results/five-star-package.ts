import { auditEntry } from "../audit/audit";
import { ZIP_TYPE } from "../documents/archive";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { ConsumerContext } from "../platform/consumer-context";
import { emit } from "../platform/emit";
import { vnDateOf } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { packageEntries } from "./five-star-package-contents";
import type { FiveStarPackage, FiveStarPackageState } from "./five-star-package-model";

/*
 * L17 SO-04 Gói đề nghị 5 sao (#89, spec #79 stories 47 to 52, 61; ADR 0009). The Cán bộ Sở picks hồ sơ of the "Đề xuất
 * 5 sao" list; the request is recorded (`pending`) with the audit of the điểm it exposes, and an outbox event hands the
 * build to a job: it gathers the văn bản of each hồ sơ, fills the dự thảo văn bản đề nghị and the mục lục, streams the
 * ZIP to `exports/` and tells the Sở in the app. Nothing of a hồ sơ changes, so the export can be repeated (story 52).
 */

/** How long a ready package can be downloaded; the bucket's lifecycle rule on `exports/` deletes it after that. */
export const FIVE_STAR_PACKAGE_DAYS = 7;
const DAY_MS = 86_400_000;
const MAX_DOSSIERS = 50;
const LIST_LIMIT = 30;

const packageNotFound = () => new DomainError("not_found", "Không tìm thấy gói đề nghị 5 sao");

export interface RequestFiveStarPackageInput {
  /** Hồ sơ of the "Đề xuất 5 sao" list, in the order wanted. */
  dossierIds: string[];
}

/** Stories 47, 61: records the request, audits the điểm từng thành viên it will carry, and queues the build. */
export function requestFiveStarPackage(deps: CoreDeps) {
  return async (actor: Actor, input: RequestFiveStarPackageInput): Promise<{ packageId: string }> => {
    authorize(actor, "results.package.export");
    const ids = [...new Set(Array.isArray(input.dossierIds) ? input.dossierIds : [])];
    if (ids.length === 0) throw new DomainError("dossiers_required", "Chọn ít nhất một hồ sơ để xuất gói");
    if (ids.length > MAX_DOSSIERS) throw new DomainError("too_many_dossiers", `Mỗi gói có tối đa ${MAX_DOSSIERS} hồ sơ`);
    for (const id of ids) assertIdShape(id, notCandidate);
    return deps.uow.run(async (tx) => {
      const listed = new Set((await tx.fiveStar.candidates()).map((c) => c.dossierId));
      if (ids.some((id) => !listed.has(id))) throw notCandidate();
      const now = deps.clock.now();
      const pkg: FiveStarPackage = {
        id: deps.ids.next(),
        requestedBy: actor.userId,
        requestedAt: now,
        dossierIds: ids,
        state: "pending",
        storageKey: null,
        size: null,
        expiresAt: null,
        completedAt: null,
        failure: null,
      };
      await tx.fiveStarPackages.insert(pkg);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.package.requested",
          targetType: "five_star_package",
          targetId: pkg.id,
          metadata: { dossierIds: ids },
        }),
      );
      // The bảng điểm of each hồ sơ names each thành viên with their điểm (CODING_STANDARDS.md "Truy cập dữ liệu cá nhân").
      for (const dossierId of ids) {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "personal_data.viewed",
            targetType: "dossier",
            targetId: dossierId,
            metadata: { view: "five_star_package", packageId: pkg.id },
          }),
        );
      }
      await emit(deps, tx, { type: "five_star_package.requested", payload: { packageId: pkg.id } });
      return { packageId: pkg.id };
    });
  };
}

const notCandidate = () => new DomainError("not_five_star_candidate", "Chỉ xuất gói cho hồ sơ trong danh sách Đề xuất 5 sao");

export interface FiveStarPackageView {
  id: string;
  requestedAt: Date;
  requestedByName: string;
  dossiers: { dossierId: string; code: string; productName: string }[];
  state: FiveStarPackageState;
  size: number | null;
  expiresAt: Date | null;
  /** Ready, but past its hạn tải. */
  expired: boolean;
  failure: string | null;
}

/** Story 51: the packages exported so far, newest first. */
export function fiveStarPackages(deps: CoreDeps) {
  return async (actor: Actor): Promise<FiveStarPackageView[]> => {
    authorize(actor, "results.package.export");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const names = new Map<string, string>();
      const views: FiveStarPackageView[] = [];
      for (const p of await tx.fiveStarPackages.list(LIST_LIMIT)) {
        if (!names.has(p.requestedBy)) names.set(p.requestedBy, (await tx.users.findById(p.requestedBy))?.fullName ?? "");
        const dossiers = [];
        for (const id of p.dossierIds) {
          const d = await tx.dossiers.findById(scope, id);
          if (d) dossiers.push({ dossierId: d.id, code: d.code, productName: d.productName });
        }
        views.push({
          id: p.id,
          requestedAt: p.requestedAt,
          requestedByName: names.get(p.requestedBy)!,
          dossiers,
          state: p.state,
          size: p.size,
          expiresAt: p.expiresAt,
          expired: p.state === "ready" && !!p.expiresAt && p.expiresAt <= now,
          failure: p.failure,
        });
      }
      return views;
    });
  };
}

const fileNameOf = (p: FiveStarPackage) => `Goi de nghi 5 sao ${vnDateOf(p.requestedAt)}.zip`;

/** A short-lived link to a ready package, until its hạn tải. */
export function downloadFiveStarPackage(deps: CoreDeps) {
  return async (actor: Actor, input: { packageId: string }): Promise<{ url: string; expiresAt: Date; fileName: string }> => {
    authorize(actor, "results.package.export");
    assertIdShape(input.packageId, packageNotFound);
    return deps.uow.run(async (tx) => {
      const p = await tx.fiveStarPackages.findById(input.packageId);
      if (!p) throw packageNotFound();
      if (p.state !== "ready" || !p.storageKey || !p.expiresAt) throw new DomainError("package_not_ready", "Gói chưa sẵn sàng để tải về");
      const now = deps.clock.now();
      if (p.expiresAt <= now) throw new DomainError("package_expired", "Gói đã hết hạn tải, hãy xuất lại");
      const fileName = fileNameOf(p);
      const get = await deps.files.presignGet(p.storageKey, { fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.package.download_issued",
          targetType: "five_star_package",
          targetId: p.id,
          metadata: { dossierIds: p.dossierIds },
        }),
      );
      return { url: get.url, expiresAt: get.expiresAt, fileName };
    });
  };
}

/**
 * Consumer of `five_star_package.requested`: builds and stores the ZIP. Any failure marks the package `failed` with
 * the reason and tells the Sở, who exports again (story 52); there is no automatic retry of a half-built package.
 */
export async function buildFiveStarPackage(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "five_star_package.requested") return;
  const { deps, tx } = c;
  const p = await tx.fiveStarPackages.findById(c.event.payload.packageId);
  if (!p || p.state !== "pending") return;
  const storageKey = `exports/five-star-packages/${p.id}.zip`;
  try {
    const entries = await packageEntries(deps, tx, p.dossierIds);
    const { size } = await deps.files.putStream(storageKey, deps.zip.zip(entries), ZIP_TYPE);
    const now = deps.clock.now();
    await tx.fiveStarPackages.markReady(p.id, { storageKey, size, expiresAt: new Date(now.getTime() + FIVE_STAR_PACKAGE_DAYS * DAY_MS), completedAt: now });
    await emit(deps, tx, { type: "five_star_package.ready", payload: { packageId: p.id, requestedBy: p.requestedBy } });
  } catch (err) {
    const failure = err instanceof DomainError ? err.message : "Lỗi hệ thống khi tạo gói";
    await tx.fiveStarPackages.markFailed(p.id, { failure, completedAt: deps.clock.now() });
    await emit(deps, tx, { type: "five_star_package.failed", payload: { packageId: p.id, requestedBy: p.requestedBy } });
  }
}

/** Consumer: tells the Cán bộ Sở who asked that the package is ready (with its link) or could not be built. */
export async function notifyFiveStarPackage(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "five_star_package.ready" && c.event.type !== "five_star_package.failed") return;
  const { packageId, requestedBy } = c.event.payload;
  const ready = c.event.type === "five_star_package.ready";
  await c.tx.notifications.insert({
    id: c.deps.ids.next(),
    userId: requestedBy,
    kind: ready ? "five_star_package_ready" : "five_star_package_failed",
    title: ready ? "Gói đề nghị 5 sao đã sẵn sàng" : "Không tạo được gói đề nghị 5 sao",
    body: ready
      ? `Tải gói về trong ${FIVE_STAR_PACKAGE_DAYS} ngày; sau đó gói bị xóa và cần xuất lại.`
      : "Xem lý do trong danh sách gói đã xuất, rồi xuất lại.",
    link: ready ? `/so/ho-so-5-sao/goi/${packageId}` : "/so/ho-so-5-sao",
    createdAt: c.deps.clock.now(),
    readAt: null,
  });
}
