'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { isWorkerOwner } from '../../authAccess';
import { useWorkspaceIdentity } from './WorkspaceIdentity';
import { saveRationale, deleteRationale, archiveRationale } from './rationaleStore';
import { groupRationalePiles,noteLabel,NOTE_KINDS,noteKind } from './rationaleNotes.mjs';
import RationalePile from './RationalePile';
import RationaleAnchorOverlay from './RationaleAnchorOverlay';
import RationaleGlossary from './RationaleGlossary';
import StickyNoteIcon from './ui/StickyNoteIcon';
import TimeButton from './ui/TimeButton';
import MemberEditButton from './ui/MemberEditButton';
import ReasonDialog from './ui/ReasonDialog';
import ArchiveNoteDialog from './ArchiveNoteDialog';

function NoteEditor({draft,onChange,onSave,onCancel,busy,isNew}) {
 return <form onSubmit={onSave} className="rationale-editor"><label>Kind<select aria-label="Sticky note kind" value={draft.kind||"why"} onChange={event=>onChange({...draft,kind:event.target.value})}>{NOTE_KINDS.map(kind=><option key={kind.key} value={kind.key}>{kind.symbol} {kind.label}</option>)}</select></label><label>Title<input placeholder="Which part of the interface?" autoFocus value={draft.title} maxLength={120} required onChange={e=>onChange({...draft,title:e.target.value})}/></label><label>Discussion<textarea placeholder="Describe a question, issue, or proposed change." rows={6} value={draft.body} maxLength={3000} required onChange={e=>onChange({...draft,body:e.target.value})}/></label><div className="rationale-editor-actions"><TimeButton disabled={busy||!draft.title.trim()||!draft.body.trim()} type="submit">{busy?'Saving…':isNew?'Add note':'Save'}</TimeButton><TimeButton quiet disabled={busy} onClick={onCancel}>Cancel</TimeButton></div></form>;
}
export default function RationaleBoard({pageKey,onClose,context,notes,allNotes,loaded,loadError}) {
 const member=useWorkspaceIdentity();
 const canArchive=Boolean(member?.id)&&member.active!==false;
 const canCreate=canArchive && isWorkerOwner(member);
 const isAuthor=note=>canArchive&&note.data.createdBy===member.id;
 const cleanup=useRef(new Set());
 useEffect(()=>{if(!loaded||!canArchive)return;for(const note of allNotes){const starter=/^(members-(shared-plan|why-time|share-results|estimates)|[a-zA-Z]+-(welcome|our-reasons))$/.test(note.id),random=note.data.title==='hehe'&&note.data.body==='jeh';if(!note.data.deleted&&(starter||random)&&note.data.createdBy===member.id&&!cleanup.current.has(note.id)){cleanup.current.add(note.id);deleteRationale(note.id,member,note.data.revision,'Remove starter or test content. Asterisks are for discussion of interface rules.').catch(err=>setError(err.message));}}},[loaded,allNotes,member?.id]);

 const [error,setError]=useState(''),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[deleting,setDeleting]=useState(null),[overrides,setOverrides]=useState({}),[glossary,setGlossary]=useState(false),[draggingNote,setDraggingNote]=useState(null),[dragTarget,setDragTarget]=useState(null),[archiving,setArchiving]=useState(null),[anchorFeedback,setAnchorFeedback]=useState(null),[landedNote,setLandedNote]=useState(null);
 useEffect(()=>{
  const escape=event=>{if(event.key!=='Escape'||busy||deleting||archiving)return;if(glossary)setGlossary(false);else onClose();};
  document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
 },[busy,deleting,archiving,glossary,onClose]);
 const edit=note=>{setError('');setEditing({id:note.id,...note.data,kind:noteKind(note).key});};
 async function save(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{await saveRationale(editing.id,{...editing,pageKey:editing.pageKey||pageKey},member,editing.revision||0);setEditing(null);}catch(err){setError(err.message||'Could not save. Your draft is still here.');}finally{setBusy(false);}}
 async function moveNote(note,layout){
  if(busy||!isAuthor(note)||note.live)return;
  setLandedNote(note.id);
  setOverrides(previous=>({...previous,[note.id]:{...previous[note.id],...layout}}));
  setBusy(true);setError('');
  try{await saveRationale(note.id,{...note.data,...layout},member,note.data.revision||0);setOverrides(previous=>{const next={...previous};delete next[note.id];return next;});}catch(err){setOverrides(previous=>{const next={...previous};delete next[note.id];return next;});setError(err.message||'Could not save the note position.');}finally{setBusy(false);}
 }
 async function archive(note){if(busy||!canArchive)return;setBusy(true);setError('');try{await archiveRationale(note,member);}finally{setBusy(false);}}
 function requestArchive(note){if(note.data.archived){archive(note).catch(err=>setError(err.message));}else setArchiving(note);}
 function anchored(target){const rect=target.getBoundingClientRect();setAnchorFeedback({label:target.dataset.rationaleLabel||'Page section',left:rect.left,top:rect.top,width:rect.width,height:rect.height});}
 useEffect(()=>{if(!anchorFeedback)return;const timer=setTimeout(()=>setAnchorFeedback(null),1600);return()=>clearTimeout(timer);},[anchorFeedback]);
 const editor=isNew=><NoteEditor draft={editing} onChange={setEditing} onSave={save} onCancel={()=>setEditing(null)} busy={busy} isNew={isNew}/>;
 const visible=notes.map(note=>({...note,data:{...note.data,...overrides[note.id]}}));
 const piles=groupRationalePiles(visible);
 const glossaryNotes=[...allNotes,...notes.filter(note=>!allNotes.some(saved=>saved.id===note.id))];
 return createPortal(<section className="rationale-board" role="region" aria-label="Page sticky notes">
  <RationaleAnchorOverlay active={Boolean(draggingNote)} selectedKey={dragTarget}/>
  {anchorFeedback&&<><div key={`${anchorFeedback.left}-${anchorFeedback.top}`} className="rationale-anchor-confirmed" style={{left:anchorFeedback.left,top:anchorFeedback.top,width:anchorFeedback.width,height:anchorFeedback.height}}/><p className="rationale-anchor-toast" role="status">Attached to {anchorFeedback.label}</p></>}
  {(error||loadError)&&<p className="rationale-error" role="alert">{error||loadError}</p>}
  {!loaded?<p role="status">Opening the notebook…</p>:<div className="rationale-notes">
    {context&&<RationalePile pile={{id:"live-context",notes:[{id:`${pageKey}-live-week`,live:true,data:{title:"Live week information",body:"Live meeting crew and quarter information"}}]}} overrides={overrides} onMove={moveNote} canDrag={isAuthor} disabled={busy} onDragState={setDraggingNote} onDragTarget={setDragTarget} onAnchored={anchored}>{()=>context}</RationalePile>}
    {piles.map(pile=><RationalePile key={pile.id} pile={pile} landedNote={landedNote} overrides={overrides} onMove={moveNote} canDrag={isAuthor} disabled={busy} onDragState={setDraggingNote} onDragTarget={setDragTarget} onAnchored={anchored}>{note=>editing?.id===note.id&&!glossary?editor(false):<><h3>{note.data.title}</h3><p>{note.data.body}</p><footer><small>{note.data.createdByName||''}</small><div className="rationale-note-actions">{isAuthor(note)&&<MemberEditButton name={`note: ${note.data.title}`} onClick={()=>edit(note)}/>}{canArchive&&<button type="button" className="rationale-pin" aria-label={`Archive ${noteLabel(note.id)}`} title="Archive note" onClick={()=>requestArchive(note)} disabled={busy}><StickyNoteIcon archive/></button>}</div></footer></>}</RationalePile>)}
    {editing&&!glossary&&!notes.some(note=>note.id===editing.id)&&<article className="rationale-note rationale-note--new">{editor(true)}</article>}
   </div>}
  <div className="rationale-corner-tools">{canCreate&&<button className="rationale-add" aria-label="Add an interface discussion" title="Add an interface discussion" disabled={Boolean(editing)||busy} onClick={()=>{setGlossary(false);setEditing({id:crypto.randomUUID(),pageKey,title:'',body:'',kind:'why',revision:0});}}>＋</button>}<button className="rationale-glossary-trigger" aria-label="Open sticky note glossary" onClick={()=>setGlossary(true)}><StickyNoteIcon stack count={glossaryNotes.length}/></button></div>
  {glossary&&<RationaleGlossary notes={glossaryNotes} member={member} canArchive={canArchive} onClose={()=>setGlossary(false)} onEdit={edit} onArchive={requestArchive} onDelete={setDeleting} editing={editing} editor={editor} busy={busy}/>}
  {archiving&&<ArchiveNoteDialog note={archiving} onCancel={()=>setArchiving(null)} onConfirm={async()=>{await archive(archiving);setArchiving(null);}}/>}
  {deleting&&<ReasonDialog title="Delete your note" message={<>Remove “{deleting.data.title}” from this page? Its history stays in the glossary.</>} confirmLabel="Delete note" destructive onCancel={()=>setDeleting(null)} onConfirm={async reason=>{await deleteRationale(deleting.id,member,deleting.data.revision,reason);setDeleting(null);}}/>}
 </section>,document.body);
}
