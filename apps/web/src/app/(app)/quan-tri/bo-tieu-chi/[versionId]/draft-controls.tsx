"use client";

import { DRAFT_NODE_KINDS, type DraftNodeKind, type MoveDirection, type NodeAddition } from "@ocop/core";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isAddTarget, type AddTarget, type EditTarget } from "@/components/criteria/edit-target";
import { EditNode, FIELDS, NodeFormDialog, valueOf, type Field } from "./edit-node";
import type { EditOutcome } from "./edit-actions";
import { addNodeAction, moveNodeAction, removeNodeAction } from "./structure-actions";

/*
 * L19 AD-03: the controls of a draft (#22 edit, #23 add, remove, reorder) that the admin pages put in the
 * EditSlot of the shared criteria views.
 */

const code = (label: string): Field => ({ key: "code", label, type: "text" });

/** The form of each kind of new node; keys match NodeAddition `values`, which the core checks. */
const ADD_FIELDS: Record<NodeAddition["node"], Field[]> = {
  productGroup: FIELDS.productGroup,
  subgroup: FIELDS.subgroup,
  set: [code("Số thứ tự bộ"), ...FIELDS.set],
  exclusion: FIELDS.exclusion,
  part: [code("Mã phần (A, B, C)"), ...FIELDS.part],
  section: [code("Mã mục"), ...FIELDS.section],
  criterionGroup: [code("Mã nhóm tiêu chí"), ...FIELDS.criterionGroup],
  criterion: FIELDS.criterion,
  scoreLevel: FIELDS.scoreLevel,
};

const isNode = (node: string): node is DraftNodeKind => (DRAFT_NODE_KINDS as readonly string[]).includes(node);

const iconButton = "inline-flex items-center rounded-md px-1 py-0.5 text-xs font-normal text-text-3 hover:bg-surface-2 hover:text-brand disabled:opacity-50";

/** What the admin draft pages pass as `edit`: "Sửa", up/down and "Xóa" on a node, "Thêm …" where one can be added. */
export function DraftControls({ versionId, target }: { versionId: string; target: EditTarget | AddTarget }) {
  if (isAddTarget(target)) return <AddNode versionId={versionId} target={target} />;
  return (
    <span className="inline-flex items-center">
      <EditNode versionId={versionId} target={target} />
      {target.id && isNode(target.node) && <NodeStructure versionId={versionId} node={target.node} id={target.id} label={target.label} />}
    </span>
  );
}

/** Up, down and remove of one node. A failure is shown with window.alert: the buttons sit inside headings. */
function NodeStructure({ versionId, node, id, label }: { versionId: string; node: DraftNodeKind; id: string; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (action: () => Promise<EditOutcome>, after?: () => void) =>
    start(async () => {
      const outcome = await action();
      if (!outcome.ok) window.alert(outcome.error);
      else after?.();
    });
  const move = (direction: MoveDirection) => run(() => moveNodeAction(versionId, node, id, direction));
  const remove = () => {
    if (!window.confirm(`Xóa ${label} cùng mọi nút con của nó khỏi bản nháp?`)) return;
    // The page of a removed Bộ tiêu chí no longer exists: go back to the version.
    run(() => removeNodeAction(versionId, node, id), node === "set" ? () => router.push(`/quan-tri/bo-tieu-chi/${versionId}`) : undefined);
  };
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => move("up")}
        className={iconButton}
        aria-label={`Chuyển ${label} lên`}
        title={`Chuyển ${label} lên`}
      >
        <ChevronUp className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => move("down")}
        className={iconButton}
        aria-label={`Chuyển ${label} xuống`}
        title={`Chuyển ${label} xuống`}
      >
        <ChevronDown className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className={`${iconButton} hover:text-danger`}
        aria-label={`Xóa ${label}`}
        title={`Xóa ${label}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </>
  );
}

/** "Thêm …": the form of a new node, added at the end of its siblings. */
function AddNode({ versionId, target }: { versionId: string; target: AddTarget }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const fields = ADD_FIELDS[target.add];

  const submit = (form: FormData) => {
    const values: Record<string, unknown> = {};
    for (const f of fields) values[f.key] = valueOf(f.type, String(form.get(f.key) ?? ""));
    const addition = { node: target.add, ...(target.parent ? { parent: target.parent } : {}), values } as NodeAddition;
    start(async () => {
      const outcome = await addNodeAction(versionId, addition);
      if (outcome.ok) setOpen(false);
      else setError(outcome.error);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (setError(undefined), setOpen(true))}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-normal text-brand hover:bg-surface-2"
      >
        <Plus className="size-3.5" aria-hidden />
        {target.label}
      </button>
      {open && (
        <NodeFormDialog
          title={target.label}
          fields={fields}
          values={{}}
          error={error}
          pending={pending}
          submitLabel="Thêm"
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
