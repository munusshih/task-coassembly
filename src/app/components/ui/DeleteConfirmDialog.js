"use client";

import { useState } from "react";
import ModalShell from "./ModalShell";
import Button from "../Button";

/**
 * DeleteConfirmDialog — shows a modal confirmation before a destructive delete.
 *
 * Usage:
 *   const [deleteTarget, setDeleteTarget] = useState(null);
 *   // To trigger: setDeleteTarget({ label: "this note", onConfirm: () => doDelete(id) })
 *   // Render:
 *   {deleteTarget && (
 *     <DeleteConfirmDialog
 *       label={deleteTarget.label}
 *       onConfirm={() => { deleteTarget.onConfirm(); setDeleteTarget(null); }}
 *       onCancel={() => setDeleteTarget(null)}
 *     />
 *   )}
 */
export default function DeleteConfirmDialog({
  label = "this item",
  detail,
  onConfirm,
  onCancel,
}) {
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim() === "DELETE";

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm?.();
  }

  return (
    <ModalShell
      title="Confirm delete"
      onClose={onCancel}
      size="sm"
      className="delete-confirm-modal"
      footer={
        <div className="delete-confirm-actions">
          <Button variant="ghost" size="small" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="small" onClick={handleConfirm} disabled={!canConfirm}>
            Delete
          </Button>
        </div>
      }
    >
      <p className="delete-confirm-body">
        Are you sure you want to delete <strong>{label}</strong>? This cannot be
        undone.
      </p>
      {detail && <p className="delete-confirm-detail">{detail}</p>}
      <label className="delete-confirm-type-row">
        <span className="delete-confirm-type-label">Type DELETE to confirm</span>
        <input
          type="text"
          className="delete-confirm-type-input"
          placeholder="DELETE"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
        />
      </label>
    </ModalShell>
  );
}
