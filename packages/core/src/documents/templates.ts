import { auditEntry } from "../audit/audit";
import { ownUpload } from "../files/attach";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { DocumentTemplate, DocumentTemplates } from "./renderer";
import { checkTemplateTags, isTemplateKind, TEMPLATE_KINDS, TEMPLATE_LABEL, TEMPLATE_SAMPLES } from "./template-variables";
import type { TemplateVersion } from "./template-version-model";

/** A văn bản filled from the mẫu đang dùng; `templateVersionId` is null for the mẫu mặc định. */
export interface RenderedDocument {
  bytes: Uint8Array;
  templateVersionId: string | null;
}

async function readAll(deps: CoreDeps, storageKey: string): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const c of await deps.files.read(storageKey)) chunks.push(c);
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes;
}

async function versionBytes(deps: CoreDeps, tx: Tx, v: TemplateVersion): Promise<Uint8Array> {
  const file = await tx.files.findById(v.fileId);
  if (!file) throw new Error(`file ${v.fileId} of template version ${v.id} is missing`);
  return readAll(deps, file.storageKey);
}

/**
 * Fills the mẫu đang dùng of a loại (story 79): the active phiên bản read from object storage, or the mẫu mặc định.
 * A use case that stores the văn bản records `templateVersionId` beside it (story 78), so a later change of mẫu
 * never changes what was issued: the stored file is the văn bản, the id says which mẫu made it.
 */
export async function renderDocument<K extends DocumentTemplate>(deps: CoreDeps, tx: Tx, kind: K, data: DocumentTemplates[K]): Promise<RenderedDocument> {
  const active = await tx.templateVersions.active(kind);
  const source = active ? await versionBytes(deps, tx, active) : undefined;
  return { bytes: await deps.documents.render(kind, data, source), templateVersionId: active?.id ?? null };
}

const versionNotFound = () => new DomainError("not_found", "Không tìm thấy phiên bản mẫu");

function assertKind(kind: unknown): asserts kind is DocumentTemplate {
  if (!isTemplateKind(kind)) throw new DomainError("template_kind_invalid", "Loại văn bản không hợp lệ");
}

async function versionOf(tx: Tx, kind: DocumentTemplate, versionId: unknown): Promise<TemplateVersion> {
  assertIdShape(versionId, versionNotFound);
  const v = await tx.templateVersions.findById(versionId);
  if (!v || v.kind !== kind) throw versionNotFound();
  return v;
}

export interface TemplateVersionView {
  id: string;
  n: number;
  fileName: string;
  uploadedByName: string;
  uploadedAt: Date;
  active: boolean;
}

export interface TemplateKindView {
  kind: DocumentTemplate;
  label: string;
  /** Null: the mẫu mặc định is in use. */
  activeVersionId: string | null;
  /** Newest first. */
  versions: TemplateVersionView[];
}

/** Story 70: every loại văn bản sinh từ mẫu with its phiên bản and the mẫu đang dùng. */
export function listTemplates(deps: CoreDeps) {
  return async (actor: Actor): Promise<TemplateKindView[]> => {
    authorize(actor, "documents.template.manage");
    return deps.uow.run(async (tx) => {
      const all = await tx.templateVersions.list();
      const names = new Map<string, string>();
      const views = new Map<string, TemplateVersionView>();
      for (const v of all) {
        if (!names.has(v.uploadedBy)) names.set(v.uploadedBy, (await tx.users.findById(v.uploadedBy))?.fullName ?? "");
        const file = await tx.files.findById(v.fileId);
        views.set(v.id, {
          id: v.id,
          n: v.n,
          fileName: file?.fileName ?? "",
          uploadedByName: names.get(v.uploadedBy)!,
          uploadedAt: v.uploadedAt,
          active: v.active,
        });
      }
      return TEMPLATE_KINDS.map((kind) => {
        const own = all.filter((v) => v.kind === kind);
        return { kind, label: TEMPLATE_LABEL[kind], activeVersionId: own.find((v) => v.active)?.id ?? null, versions: own.map((v) => views.get(v.id)!) };
      });
    });
  };
}

const fileNameOf = (kind: DocumentTemplate, v: TemplateVersion | null) => `${TEMPLATE_LABEL[kind]} - ${v ? `phiên bản ${v.n}` : "mẫu mặc định"}.docx`;

/** Story 71: the Word file of a phiên bản, or of the mẫu mặc định (`versionId` null), its variables in place. */
export function downloadTemplate(deps: CoreDeps) {
  return async (actor: Actor, input: { kind: DocumentTemplate; versionId: string | null }): Promise<{ fileName: string; bytes: Uint8Array }> => {
    authorize(actor, "documents.template.manage");
    assertKind(input.kind);
    const kind = input.kind;
    if (input.versionId === null) return { fileName: fileNameOf(kind, null), bytes: deps.documents.builtIn(kind) };
    return deps.uow.run(async (tx) => {
      const v = await versionOf(tx, kind, input.versionId);
      return { fileName: fileNameOf(kind, v), bytes: await versionBytes(deps, tx, v) };
    });
  };
}

/** Story 77: a phiên bản, or the mẫu mặc định, filled with the dữ liệu mẫu cố định; nothing is stored. */
export function previewTemplate(deps: CoreDeps) {
  return async (actor: Actor, input: { kind: DocumentTemplate; versionId: string | null }): Promise<{ fileName: string; bytes: Uint8Array }> => {
    authorize(actor, "documents.template.manage");
    assertKind(input.kind);
    const kind = input.kind;
    return deps.uow.run(async (tx) => {
      const v = input.versionId === null ? null : await versionOf(tx, kind, input.versionId);
      const source = v ? await versionBytes(deps, tx, v) : undefined;
      const bytes = await deps.documents.render(kind, TEMPLATE_SAMPLES[kind], source);
      return { fileName: `Sinh thử - ${fileNameOf(kind, v)}`, bytes };
    });
  };
}

const templateFileNotFound = () => new DomainError("not_found", "Không tìm thấy tệp mẫu đã tải lên");

/** Refuses a template that cannot fill this loại, naming what is wrong (stories 74, 75). */
function assertValidTemplate(deps: CoreDeps, kind: DocumentTemplate, bytes: Uint8Array) {
  const inspected = deps.documents.inspect(bytes);
  if (!inspected.ok && inspected.error === "not_docx") throw new DomainError("template_not_docx", "Tệp không phải văn bản Word (.docx) mở được");
  if (!inspected.ok) {
    throw new DomainError("template_syntax_error", `Mẫu có biến viết sai cú pháp: ${inspected.details.join("; ")}`);
  }
  const problem = checkTemplateTags(kind, inspected.tags);
  if (problem?.code === "template_unknown_variable") {
    throw new DomainError(problem.code, `Mẫu dùng biến không có trong danh sách biến: ${problem.variables.join(", ")}`);
  }
  if (problem) throw new DomainError(problem.code, `Mẫu thiếu biến bắt buộc: ${problem.variables.join(", ")}`);
}

/**
 * Story 73: a Word file the Quản trị uploaded (purpose `document_template`, scanned clean) becomes the next phiên bản
 * of the loại, and with `activate` the mẫu đang dùng; without, it waits for a Sinh thử (story 77).
 */
export function uploadTemplate(deps: CoreDeps) {
  return async (actor: Actor, input: { kind: DocumentTemplate; fileId: string; activate: boolean }): Promise<{ versionId: string; n: number }> => {
    authorize(actor, "documents.template.manage");
    assertKind(input.kind);
    const kind = input.kind;
    return deps.uow.run(async (tx) => {
      const file = await ownUpload(tx, actor, input.fileId, "document_template", templateFileNotFound);
      if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa quét xong, hãy thử lại sau ít phút");
      assertValidTemplate(deps, kind, await readAll(deps, file.storageKey));
      await tx.templateVersions.lockKind(kind);
      const versions = await tx.templateVersions.list(kind);
      if (versions.some((v) => v.fileId === file.id)) throw new DomainError("already_attached", "Tệp này đã là một phiên bản mẫu");
      const before = versions.find((v) => v.active)?.id ?? null;
      const now = deps.clock.now();
      const version: TemplateVersion = {
        id: deps.ids.next(),
        kind,
        n: (versions[0]?.n ?? 0) + 1,
        fileId: file.id,
        uploadedBy: actor.userId,
        uploadedAt: now,
        active: false,
      };
      await tx.templateVersions.insert(version);
      if (input.activate) await tx.templateVersions.setActive(kind, version.id);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "documents.template.uploaded",
          targetType: "document_template",
          targetId: kind,
          before: input.activate ? { activeVersionId: before } : undefined,
          after: input.activate ? { activeVersionId: version.id } : undefined,
          metadata: { versionId: version.id, n: version.n, fileId: file.id, activated: input.activate },
        }),
      );
      return { versionId: version.id, n: version.n };
    });
  };
}

/** Story 76: makes a phiên bản, or the mẫu mặc định (`versionId` null), the mẫu đang dùng of its loại. */
export function activateTemplate(deps: CoreDeps) {
  return async (actor: Actor, input: { kind: DocumentTemplate; versionId: string | null }): Promise<void> => {
    authorize(actor, "documents.template.manage");
    assertKind(input.kind);
    const kind = input.kind;
    await deps.uow.run(async (tx) => {
      await tx.templateVersions.lockKind(kind);
      const target = input.versionId === null ? null : await versionOf(tx, kind, input.versionId);
      const before = (await tx.templateVersions.active(kind))?.id ?? null;
      if (before === (target?.id ?? null)) return;
      await tx.templateVersions.setActive(kind, target?.id ?? null);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "documents.template.activated",
          targetType: "document_template",
          targetId: kind,
          before: { activeVersionId: before },
          after: { activeVersionId: target?.id ?? null },
          metadata: { n: target?.n ?? null },
        }),
      );
    });
  };
}
