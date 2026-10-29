'use client';
import {useState} from 'react';
import {filterRationaleGlossary,noteLabel,noteKind} from './rationaleNotes.mjs';
import CloseButton from './ui/CloseButton';
import TimeButton from './ui/TimeButton';
import StickyNoteIcon from './ui/StickyNoteIcon';
const pages={members:'Task',memberDirectory:'Members',projects:'Projects',backlog:'Wishes',meetingNotes:'Notes',resources:'Resource',finance:'Finance',payouts:'Requests',settings:'Settings'};
export default function RationaleGlossary({notes,member,canArchive,onClose,onEdit,onArchive,onDelete,editing,editor,busy}) {
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[sort,setSort]=useState('newest');
 const visible=filterRationaleGlossary(notes,query,status,sort);
 return <section className="rationale-glossary" aria-label="Sticky note glossary"><header><div><h2>Glossary <span className="task-scope-count">{notes.length}</span></h2><p>Every shared note, including archived and removed ones.</p></div><CloseButton label="Close glossary" onClick={onClose}/></header>
  <div className="rationale-glossary-tools"><input type="search" aria-label="Search sticky notes" placeholder="Search a reason, ID, person, or page…" value={query} onChange={e=>setQuery(e.target.value)}/><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All notes</option><option value="active">Active</option><option value="archived">Archived</option><option value="deleted">Removed</option></select></label><label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option><option value="page">Page</option></select></label></div>
  <div className="rationale-glossary-list">{visible.map(note=><article key={note.id} className="rationale-note rationale-glossary-item" data-kind={noteKind(note).key} style={{"--note-paper":`var(--${noteKind(note).paper})`}}><div className="rationale-glossary-meta"><code>{noteLabel(note.id)}</code><span>{pages[note.data.pageKey]||note.data.pageKey}</span><span>{note.data.deleted?'Removed':note.data.archived?'Archived':'Active'}</span>{note.data.createdByName&&<span>by {note.data.createdByName}</span>}</div>{editing?.id===note.id?editor(false):<><h3>{note.data.title}</h3><p>{note.data.body}</p>{note.data.deleted&&note.data.deleteReason&&<p className="rationale-removal-reason">Removed: {note.data.deleteReason}</p>}{!note.data.deleted&&canArchive&&<div className="rationale-editor-actions">{note.data.createdBy===member?.id&&<TimeButton quiet onClick={()=>onEdit(note)} disabled={busy}>Edit</TimeButton>}<button className="rationale-archive-action" aria-label={`${note.data.archived?'Unarchive':'Archive'} ${noteLabel(note.id)}`} title={note.data.archived?'Unarchive':'Archive'} onClick={()=>onArchive(note)} disabled={busy}><StickyNoteIcon archive/></button>{note.data.createdBy===member?.id&&<TimeButton quiet disabled={busy} onClick={()=>onDelete(note)}>Delete</TimeButton>}</div>}</>}</article>)}</div>
  {!visible.length&&<p>No matching notes.</p>}
 </section>;
}
