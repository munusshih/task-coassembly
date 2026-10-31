'use client';
import {useState} from 'react';
import ModalShell from './ui/ModalShell';
import FormActions from './ui/FormActions';
import TimeButton from './ui/TimeButton';
export default function ArchiveNoteDialog({note,onConfirm,onCancel}) {
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 async function confirm(){setPending(true);setError('');try{await onConfirm();}catch(failure){setError(failure.message||'Could not archive this note.');}finally{setPending(false);}}
 return <ModalShell title="Archive this note?" onClose={pending?undefined:onCancel} size="sm" footer={<FormActions><TimeButton onClick={confirm} disabled={pending}>{pending?'Archiving…':'Archive note'}</TimeButton><TimeButton quiet onClick={onCancel} disabled={pending}>Keep note</TimeButton></FormActions>}><p>“{note.data.title}” will leave the page. You can find it and bring it back from the glossary.</p>{error&&<p role="alert">{error}</p>}</ModalShell>;
}
