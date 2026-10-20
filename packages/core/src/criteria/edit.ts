import { z } from "zod";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { changeDraft, findDraftNode, type DraftChange, type DraftChangeResult } from "./draft-change";
import type { DraftNodeKind } from "./draft-events";
import type { RankThresholds } from "./model";
import type { DraftNodeRows } from "./version";

/*
 * L19 AD-03: Quản trị edits the content of a draft Phiên bản tiêu chí, one node at a time. Structure
 * (add, remove, reorder) is #23. The schema below is the single description of what is editable and how
 * each value is checked; the web parses form input with it too.
 */

export const required = z.string().trim().min(1, "Không được để trống");
export const optionalText = z.string().trim();
/** numeric(7,2) in the database. */
export const points = z
  .number({ error: "Phải là số" })
  .finite("Phải là số")
  .min(0, "Không được âm")
  .max(99999.99, "Quá lớn")
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "Tối đa hai chữ số thập phân");
const isoDate = z.iso.date({ error: "Phải là ngày dạng YYYY-MM-DD" });
/** Sao tối thiểu as printed (***, ****, *****), or none. */
export const minimumStar = z.union([z.literal(3), z.literal(4), z.literal(5), z.null()], { error: "Phải là 3, 4, 5 sao hoặc để trống" });
/** Nhãn nhánh "a", "b"…; blank means the Tiêu chí does not split. */
export const branch = z
  .string()
  .trim()
  .max(10, "Tối đa 10 ký tự")
  .nullable()
  .transform((b) => (b ? b : null));

const node = <K extends DraftNodeKind, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.object({ node: z.literal(kind), id: z.string().min(1), changes: z.strictObject(shape).partial() });

/** One edit: the node and the new values of the fields that change. Fields left out keep their value. */
export const draftEditSchema = z.discriminatedUnion("node", [
  z.object({ node: z.literal("version"), changes: z.strictObject({ legalBasis: required, issuedOn: isoDate, effectiveOn: isoDate }).partial() }),
  z.object({ node: z.literal("thresholds"), changes: z.strictObject({ 2: points, 3: points, 4: points, 5: points }).partial() }),
  node("productGroup", { name: required }),
  node("subgroup", { name: required }),
  node("set", { name: required, totalPoints: points }),
  node("exclusion", { description: required }),
  node("part", { name: required, points }),
  node("section", { name: required, points }),
  node("criterionGroup", { name: required, points }),
  node("criterion", { code: required, name: required, requirement: optionalText, note: optionalText, maxPoints: points }),
  node("scoreLevel", { description: required, points, minimumStar, branch }),
]);

export type DraftEdit = z.input<typeof draftEditSchema>;
type ParsedEdit = z.output<typeof draftEditSchema>;

export interface EditDraftInput {
  versionId: string;
  edit: DraftEdit;
}

/** Vietnamese names of the fields, for error messages. */
const FIELD_LABEL: Record<string, string> = {
  legalBasis: "Văn bản căn cứ",
  issuedOn: "Ngày ban hành",
  effectiveOn: "Ngày hiệu lực",
  2: "Ngưỡng 2 sao",
  3: "Ngưỡng 3 sao",
  4: "Ngưỡng 4 sao",
  5: "Ngưỡng 5 sao",
  name: "Tên",
  code: "Mã",
  totalPoints: "Tổng điểm",
  points: "Điểm",
  maxPoints: "Điểm tối đa",
  requirement: "Yêu cầu",
  note: "Ghi chú",
  description: "Mô tả",
  minimumStar: "Sao tối thiểu",
  branch: "Nhãn nhánh",
};

/**
 * Parses with `schema`, turning the first problem into `invalid_value` named by the field it is in
 * (`<container>.<field>`, e.g. `changes.name`), or `fallback` when it is not about one field.
 */
export function parseOrRefuse<S extends z.ZodType>(schema: S, value: unknown, container: string, fallback: string): z.output<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0]!;
  const field = issue.path[0] === container && issue.path[1] !== undefined ? FIELD_LABEL[String(issue.path[1])] : undefined;
  throw new DomainError("invalid_value", field ? `${field}: ${issue.message}` : fallback);
}

const parseEdit = (edit: unknown): ParsedEdit => parseOrRefuse(draftEditSchema, edit, "changes", "Nội dung sửa không hợp lệ");

/** The fields of `changes` whose value differs from `current`, as before/after pairs; null when none does. */
function diff<T extends object>(current: T, changes: Partial<T>): { before: Partial<T>; after: Partial<T> } | null {
  const before: Partial<T> = {};
  const after: Partial<T> = {};
  for (const key of Object.keys(changes) as (keyof T)[]) {
    if (changes[key] === undefined || changes[key] === current[key]) continue;
    before[key] = current[key];
    after[key] = changes[key];
  }
  return Object.keys(after).length > 0 ? { before, after } : null;
}

/** L19 AD-03: one edit of a draft; returns the check after it. Quản trị only. */
export function editDraft(deps: CoreDeps) {
  return async (actor: Actor, input: EditDraftInput): Promise<DraftChangeResult> => {
    authorize(actor, "criteria.edit");
    const edit = parseEdit(input.edit);
    return changeDraft(deps, actor, input.versionId, async (tx, version): Promise<DraftChange | null> => {
      const edited = (nodeId: string, d: { before: object; after: object } | null): DraftChange | null =>
        d && { action: "criteria.draft.edited", node: edit.node, nodeId, before: { ...d.before }, after: { ...d.after } };

      if (edit.node === "version") {
        const d = diff({ legalBasis: version.legalBasis, issuedOn: version.issuedOn, effectiveOn: version.effectiveOn }, edit.changes);
        if (d) await tx.criteriaVersions.updateVersion(version.id, d.after);
        return edited(version.id, d);
      }
      if (edit.node === "thresholds") {
        const current: RankThresholds = (await tx.criteriaVersions.taxonomy(version.id)).thresholds;
        const d = diff(current, edit.changes);
        if (d) await tx.criteriaVersions.setThresholds(version.id, { ...current, ...d.after });
        return edited(version.id, d);
      }
      const row = await findDraftNode(tx, version, edit.node, edit.id);
      const d = diff<DraftNodeRows[typeof edit.node]>(row, edit.changes);
      if (!d) return null;
      const patch: Partial<DraftNodeRows[DraftNodeKind]> = { ...d.after };
      // A system-added "Không đáp ứng, 0 điểm" level (GLOSSARY.md) that Quản trị changes in any way (points,
      // description, Sao tối thiểu...) is Quản trị's own level from then on. `d` holds only real changes.
      if (edit.node === "scoreLevel" && "systemAdded" in row && row.systemAdded) {
        Object.assign(patch, { systemAdded: false });
      }
      await tx.criteriaVersions.updateNode(edit.node, edit.id, patch);
      return edited(edit.id, d);
    });
  };
}
