'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isWorkerOwner } from '../../authAccess';
import { useWorkspaceIdentity } from './WorkspaceIdentity';
import { saveRationale, deleteRationale, archiveRationale } from './rationaleStore';
import { groupRationalePiles,noteLabel,NOTE_KINDS,noteKind,withRationaleNumbers,rationaleDefaults,mergeRationaleDefaults } from './rationaleNotes.mjs';
import RationalePile from './RationalePile';
import RationaleAnchorOverlay from './RationaleAnchorOverlay';
import RationaleGlossary from './RationaleGlossary';
import StickyNoteIcon from './ui/StickyNoteIcon';
import TimeButton from './ui/TimeButton';
import MemberEditButton from './ui/MemberEditButton';
import ReasonDialog from './ui/ReasonDialog';
import ArchiveNoteDialog from './ArchiveNoteDialog';
import RationaleNoteFooter from './RationaleNoteFooter';
import FormActions from './ui/FormActions';
import styles from './RationaleBoard.module.css';
import ModalShell from './ui/ModalShell';

function NoteEditor({draft,onChange,onSave,onCancel,busy,isNew,canPublish}) {
 const kinds=canPublish?NOTE_KINDS:NOTE_KINDS.filter(kind=>kind.key==='question');
 return <form onSubmit={onSave} className="rationale-editor"><label>Discussion type<select aria-label="Sticky note kind" disabled={!canPublish} value={draft.kind||"question"} onChange={event=>onChange({...draft,kind:event.target.value})}>{kinds.map(kind=><option key={kind.key} value={kind.key}>{kind.symbol} {kind.label}</option>)}</select></label><label>Title<input placeholder={canPublish?"Which part of the interface?":"What should we revisit?"} autoFocus value={draft.title} maxLength={120} required onChange={e=>onChange({...draft,title:e.target.value})}/></label><label>Bylaw link<input type="url" placeholder="https://bylaws.coassembly.work/bylaws/…" value={draft.sourceUrl||''} onChange={event=>onChange({...draft,sourceUrl:event.target.value})}/></label><label>Discussion<textarea placeholder={canPublish?"Describe the rationale or proposal.":"Explain what you question or would change."} rows={6} value={draft.body} maxLength={3000} required onChange={e=>onChange({...draft,body:e.target.value})}/></label>{!canPublish&&<p className="rationale-editor-guidance">Any active member can raise a question. Bylaw-backed explanations stay sourced and can be revised by worker-owners after discussion.</p>}<FormActions className="rationale-editor-actions"><TimeButton disabled={busy||!draft.title.trim()||!draft.body.trim()} type="submit">{busy?'Saving…':isNew?'Add asterisk':'Save'}</TimeButton><TimeButton quiet disabled={busy} onClick={onCancel}>Cancel</TimeButton></FormActions></form>;
}
export default function RationaleBoard({pageKey,onClose,context,notes,allNotes,loaded,loadError}) {
 const member=useWorkspaceIdentity();
 const canArchive=Boolean(member?.id)&&member.active!==false;
 const canCreate=canArchive;
 const canPublish=canCreate&&isWorkerOwner(member);
 const isAuthor=note=>canArchive&&note.data.createdBy===member.id;

 const [error,setError]=useState(''),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[deleting,setDeleting]=useState(null),[overrides,setOverrides]=useState({}),[glossary,setGlossary]=useState(false),[draggingNote,setDraggingNote]=useState(null),[dragTarget,setDragTarget]=useState(null),[archiving,setArchiving]=useState(null),[anchorFeedback,setAnchorFeedback]=useState(null),[landedNote,setLandedNote]=useState(null);
 useEffect(()=>{
  const escape=event=>{if(event.key!=='Escape'||busy||deleting||archiving)return;if(editing)setEditing(null);else if(glossary)setGlossary(false);else onClose();};
  document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
 },[busy,deleting,archiving,glossary,editing,onClose]);
 const edit=note=>{setError('');setEditing({id:note.id,...note.data,sourceUrl:note.sourceUrl||'',isNew:false,kind:noteKind(note).key});};
 const challenge=note=>{setError('');setGlossary(false);setEditing({id:crypto.randomUUID(),pageKey,title:`Question: ${note.data.title}`.slice(0,120),body:`The bylaw explanation says: “${note.data.title}”.\n\nWhat should we revisit?\n`,kind:'question',revision:0});};
 async function save(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{await saveRationale(editing.id,{...editing,pageKey:editing.pageKey||pageKey},member,editing.revision||0);setEditing(null);}catch(err){setError(err.message||'Could not save. Your draft is still here.');}finally{setBusy(false);}}
 async function moveNote(note,layout){
  if(busy||!isAuthor(note)||note.live)return;
  setLandedNote(note.id);
  setOverrides(previous=>({...previous,[note.id]:{...previous[note.id],...layout}}));
  setBusy(true);setError('');
  try{await saveRationale(note.id,{...note.data,sourceUrl:note.sourceUrl||'',...layout},member,note.data.revision||0);setOverrides(previous=>{const next={...previous};delete next[note.id];return next;});}catch(err){setOverrides(previous=>{const next={...previous};delete next[note.id];return next;});setError(err.message||'Could not save the note position.');}finally{setBusy(false);}
 }
 async function archive(note){if(busy||!canArchive)return;setBusy(true);setError('');try{await archiveRationale(note,member);}finally{setBusy(false);}}
 function requestArchive(note){if(note.data.archived){archive(note).catch(err=>setError(err.message));}else setArchiving(note);}
 function anchored(target){const rect=target.getBoundingClientRect();setAnchorFeedback({label:target.dataset.rationaleLabel||'Page section',left:rect.left,top:rect.top,width:rect.width,height:rect.height});}
 useEffect(()=>{if(!anchorFeedback)return;const timer=setTimeout(()=>setAnchorFeedback(null),1600);return()=>clearTimeout(timer);},[anchorFeedback]);
 const editor=isNew=><NoteEditor draft={editing} onChange={setEditing} onSave={save} onCancel={()=>setEditing(null)} busy={busy} isNew={isNew} canPublish={canPublish}/>;
 const numberedNotes=withRationaleNumbers(mergeRationaleDefaults(rationaleDefaults(),allNotes));
 const glossaryNotes=numberedNotes.filter(note=>!note.data.deleted);
 const numberById=new Map(numberedNotes.map(note=>[note.id,note.number]));
 const visible=notes.map(note=>({...note,number:numberById.get(note.id),data:{...note.data,...overrides[note.id]}}));
 const piles=groupRationalePiles(visible);
 return createPortal(<section className={`rationale-board ${styles.surface}`} role="region" aria-label="Page sticky notes">
  <RationaleAnchorOverlay active={Boolean(draggingNote)} selectedKey={dragTarget}/>
  {anchorFeedback&&<><div key={`${anchorFeedback.left}-${anchorFeedback.top}`} className="rationale-anchor-confirmed" style={{left:anchorFeedback.left,top:anchorFeedback.top,width:anchorFeedback.width,height:anchorFeedback.height}}/><p className="rationale-anchor-toast" role="status">Attached to {anchorFeedback.label}</p></>}
  {(error||loadError)&&<p className="rationale-error" role="alert">{error||loadError}</p>}
  {!loaded?<p role="status">Opening the notebook…</p>:<div className="rationale-notes">
    {context&&<RationalePile pile={{id:"live-context",notes:[{id:`${pageKey}-live-week`,live:true,data:{title:"Live week information",body:"Live meeting crew and quarter information",countdown:context?.props?.["data-countdown"]}}]}} overrides={overrides} onMove={moveNote} canDrag={isAuthor} disabled={busy} onDragState={setDraggingNote} onDragTarget={setDragTarget} onAnchored={anchored}>{()=>context}</RationalePile>}
    {piles.map(pile=><RationalePile key={pile.id} pile={pile} landedNote={landedNote} overrides={overrides} onMove={moveNote} canDrag={isAuthor} disabled={busy} onDragState={setDraggingNote} onDragTarget={setDragTarget} onAnchored={anchored}>{note=><><h3>{note.data.title}</h3><p>{note.data.body}</p><RationaleNoteFooter note={note} onChallenge={canCreate?challenge:undefined} busy={busy}>{(isAuthor(note)||(note.builtIn&&canPublish))&&<MemberEditButton name={`note: ${note.data.title}`} onClick={()=>edit(note)}/ >}{canArchive&&!note.builtIn&&<button type="button" className="rationale-pin" aria-label={`Archive ${noteLabel(note)}`} title="Archive note" onClick={()=>requestArchive(note)} disabled={busy}><StickyNoteIcon archive/></button>}</RationaleNoteFooter></>}</RationalePile>)}

   </div>}
  <div className="rationale-corner-tools">{canCreate&&<button className="rationale-add" aria-label={canPublish?"Add an interface rationale":"Add a question or challenge"} title={canPublish?"Add an interface rationale":"Add a question or challenge"} disabled={Boolean(editing)||busy} onClick={()=>{setGlossary(false);setEditing({id:crypto.randomUUID(),pageKey,title:'',body:'',kind:canPublish?'why':'question',revision:0,isNew:true});}}>＋</button>}<button className="rationale-glossary-trigger" aria-label="Open sticky note glossary" onClick={()=>setGlossary(true)}><StickyNoteIcon stack count={glossaryNotes.length}/></button></div>
  {glossary&&<RationaleGlossary notes={glossaryNotes} member={member} canArchive={canArchive} canCreate={canCreate} canPublish={canPublish} onChallenge={challenge} onClose={()=>setGlossary(false)} onEdit={edit} onArchive={requestArchive} onDelete={setDeleting} editing={editing} editor={editor} busy={busy}/>}
  {editing&&<ModalShell title={editing.isNew?"New asterisk":"Edit asterisk"} size="lg" className={`rationale-edit-modal ${styles.surface}`} onClose={()=>setEditing(null)}>{error&&<p role="alert">{error}</p>}{editor(Boolean(editing.isNew))}</ModalShell>}
  {archiving&&<ArchiveNoteDialog note={archiving} onCancel={()=>setArchiving(null)} onConfirm={async()=>{await archive(archiving);setArchiving(null);}}/>}
  {deleting&&<ReasonDialog title="Delete your note" message={<>Remove “{deleting.data.title}” from this page? It will leave the page and glossary.</>} confirmLabel="Delete note" destructive onCancel={()=>setDeleting(null)} onConfirm={async reason=>{await deleteRationale(deleting.id,member,deleting.data.revision,reason);setDeleting(null);}}/>}
 </section>,document.body);
}
