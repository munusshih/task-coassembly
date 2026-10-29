"use client";
import ReasonDialog from './ReasonDialog';
export default function DeleteConfirmDialog({ label = 'this item', detail, onConfirm, onCancel }) {
  return <ReasonDialog title="Confirm delete" message={<>Delete <strong>{label}</strong>? This cannot be undone.{detail && <span className="delete-confirm-detail"> {detail}</span>}</>} confirmLabel="Delete" destructive requireDeleteText onConfirm={onConfirm} onCancel={onCancel} />;
}
