"use client";
import { useState } from 'react';
import ModalShell from './ModalShell';
import TextareaField from './TextareaField';
import Button from '../Button';
import FormActions from './FormActions';
import { requireActionReason } from '../../../lib/actionReason.mjs';

export default function ReasonDialog({ title, message, confirmLabel = 'Confirm', destructive = false, requireDeleteText = false, illustration, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const enabled = reason.trim() && reason.trim().length <= 2000 && (!requireDeleteText || confirmation.trim() === 'DELETE') && !pending;
  async function submit() {
    if (!enabled) return;
    setPending(true); setError('');
    try { await onConfirm(requireActionReason(reason)); }
    catch (failure) { setError(failure.message || 'Could not complete this action.'); }
    finally { setPending(false); }
  }
  return <ModalShell title={title} onClose={pending ? undefined : onCancel} size="sm" className={`reason-dialog${illustration ? " reason-dialog--illustrated" : ""}`} footer={<FormActions><Button variant={destructive ? 'danger' : undefined} onClick={submit} disabled={!enabled}>{pending ? 'Saving…' : confirmLabel}</Button><Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button></FormActions>}>
    <div className="reason-dialog-content">
    {illustration && <img className="reason-dialog-illustration" src={`/illustrations/${illustration}-person.svg`} alt="" />}
    <div className="reason-dialog-fields">
    {message && <p>{message}</p>}
    <label className="reason-dialog-field"><span>Reason</span><TextareaField value={reason} onChange={event => setReason(event.target.value)} placeholder="A little context for the team…" rows={4} maxLength={2000} required autoFocus /></label>
    {requireDeleteText && <label className="reason-dialog-field"><span>Type DELETE to confirm</span><input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="DELETE" autoComplete="off" /></label>}
    {error && <p role="alert">{error}</p>}
    </div></div>
  </ModalShell>;
}
