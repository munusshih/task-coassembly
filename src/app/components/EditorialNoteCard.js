'use client';
import {useState} from 'react';
import CountBadge from './ui/CountBadge';
import EditButton from './ui/EditButton';
import IconButton from './IconButton';
import {DELETE_ICON} from './icons';
import {noteCover,noteExcerpt} from '../lib/notePresentation.mjs';
export function NoteCover({src,title='',className=''}) {
 const [failed,setFailed]=useState(false);
 if(!src||failed)return null;
 return <img className={`note-editorial-image ${className}`} src={src} alt={title?`Cover for ${title}`:''} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}
export default function EditorialNoteCard({note,index,projectName,author,date,linkedHost,onOpen,onEdit,onDelete}) {
 const cover=noteCover(note.data),excerpt=noteExcerpt(note.data);
 return <li className="note-editorial-card" data-rationale-anchor={`note-${note.id}`} data-rationale-label={note.data.title||'Note'} role="button" tabIndex={0} aria-label={`Open note ${note.data.title||'Untitled'}`} onClick={onOpen} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(['Enter',' '].includes(event.key)){event.preventDefault();onOpen();}}}>
  <div className="note-editorial-tags"><CountBadge>{String(index+1).padStart(2,'0')}</CountBadge><span>{projectName||'Meeting'}</span>{linkedHost&&<span>Link</span>}</div>
  <NoteCover key={cover} src={cover} title={note.data.title}/>
  <h4>{note.data.title||'Untitled'}</h4>
  {!cover&&excerpt&&note.matchType&&<p className="note-editorial-excerpt">{excerpt}</p>}
  {note.matchType&&<small className="note-editorial-match">Matched in {note.matchType}</small>}
  <footer><div><span>{author}</span><time>{date}</time>{linkedHost&&<span>{linkedHost}</span>}</div><div className="note-editorial-actions"><EditButton label={`Edit ${note.data.title||'note'}`} onClick={event=>{event.stopPropagation();onEdit();}}/><IconButton title={`Delete ${note.data.title||'note'}`} variant="delete" onClick={event=>{event.stopPropagation();onDelete();}}>{DELETE_ICON}</IconButton></div></footer>
 </li>;
}
