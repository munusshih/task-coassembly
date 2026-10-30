'use client';
import ModalShell from './ui/ModalShell';
import SearchField from './ui/SearchField';
import SelectField from './ui/SelectField';
import MemberEditButton from './ui/MemberEditButton';
import {useState} from 'react';
import {filterRationaleGlossary,noteLabel,noteKind} from './rationaleNotes.mjs';
import StickyNoteIcon from './ui/StickyNoteIcon';
const pages={members:'Task',memberDirectory:'Members',projects:'Projects',backlog:'Wishes',meetingNotes:'Notes',resources:'Resource',finance:'Finance',payouts:'Requests',settings:'Settings'};
export default function RationaleGlossary({notes,member,canArchive,onClose,onEdit,onArchive,onDelete,editing,editor,busy}) {
 const [query,setQuery]=useState(''),[status,setStatus]=useState('active'),[sort,setSort]=useState('newest');
 const visible=filterRationaleGlossary(notes,query,status,sort);
 return <ModalShell fullscreen title={`Asterisks · ${notes.length}`} onClose={onClose} className="asterisks-modal"><section className="rationale-glossary" aria-label="Asterisks">
  <div className="rationale-glossary-tools"><SearchField ariaLabel="Search asterisks" placeholder="Search rules and ideas…" value={query} onChange={e=>setQuery(e.target.value)}/><label>Status<SelectField value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All notes</option><option value="active">Active</option><option value="archived">Archived</option><option value="deleted">Removed</option></SelectField></label><label>Sort<SelectField value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option><option value="page">Page</option></SelectField></label></div>
  <div className="rationale-glossary-list">{visible.map(note=><article key={note.id} className="rationale-note rationale-glossary-item" data-kind={noteKind(note).key} style={{"--note-paper":`var(--${noteKind(note).paper})`}}><header className="rationale-note-label rationale-glossary-meta"><code>{noteLabel(note.id)}</code><span>{pages[note.data.pageKey]||note.data.pageKey}</span><span>{note.data.deleted?'Removed':note.data.archived?'Archived':'Active'}</span>{note.data.createdByName&&<span>by {note.data.createdByName}</span>}</header>{editing?.id===note.id?editor(false):<><h3>{note.data.title}</h3><p>{note.data.body}</p>{note.data.deleted&&note.data.deleteReason&&<p className="rationale-removal-reason">Removed: {note.data.deleteReason}</p>}{!note.data.deleted&&canArchive&&<footer><small>{note.data.createdByName}</small><div className="rationale-note-actions">{note.data.createdBy===member?.id&&<MemberEditButton name={note.data.title} onClick={()=>onEdit(note)}/>}<button className="rationale-archive-action" aria-label={`${note.data.archived?'Unarchive':'Archive'} ${noteLabel(note.id)}`} title={note.data.archived?'Unarchive':'Archive'} onClick={()=>onArchive(note)} disabled={busy}><StickyNoteIcon archive/></button>{note.data.createdBy===member?.id&&<button type="button" className="rationale-delete" aria-label={`Remove ${note.data.title}`} onClick={()=>onDelete(note)} disabled={busy}>×</button>}</div></footer>}</>}</article>)}</div>
  {!visible.length&&<p>No matching notes.</p>}
 </section></ModalShell>;
}
