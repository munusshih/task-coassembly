'use client';
import {useState} from 'react';
import PersonIdentity from './ui/PersonIdentity';
import MetadataPill from './ui/MetadataPill';
import LetterBadge from './ui/LetterBadge';
import EditButton from './ui/EditButton';
import IconButton from './IconButton';
import {DELETE_ICON} from './icons';
import {noteCover} from '../lib/notePresentation.mjs';
export function NoteCover({src,title='',className=''}) {
 const [failed,setFailed]=useState(false);
 if(!src||failed)return null;
 return <img className={`note-editorial-image ${className}`} src={src} alt={title?`Cover for ${title}`:''} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}
export default function EditorialNoteCard({note,index,projectName,author,authorMember,projectTone,date,linkedHost,onOpen,onEdit,onDelete}) {
 const cover=noteCover(note.data);
 return <li className="note-editorial-card" data-rationale-anchor={`note-${note.id}`} data-rationale-label={note.data.title||'Note'} role="button" tabIndex={0} aria-label={`Open note ${note.data.title||'Untitled'}`} onClick={onOpen} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(['Enter',' '].includes(event.key)){event.preventDefault();onOpen();}}}>
  <div className="note-editorial-tags"><LetterBadge index={index} quiet/><MetadataPill tone={projectTone||"project"}>{projectName||'Meeting'}</MetadataPill>{linkedHost&&<MetadataPill tone="blue">Link</MetadataPill>}</div>
  <NoteCover key={cover} src={cover} title={note.data.title}/>
  <h4>{note.data.title||'Untitled'}</h4>
  {note.matchType&&note.matchType!=='title'&&<small className="note-editorial-match">Matched in {note.matchType}: “{note.matchText?.slice(0,note.matchText.toLowerCase().indexOf(note.matchQuery.toLowerCase()))}<mark>{note.matchText?.slice(note.matchText.toLowerCase().indexOf(note.matchQuery.toLowerCase()),note.matchText.toLowerCase().indexOf(note.matchQuery.toLowerCase())+note.matchQuery.length)}</mark>{note.matchText?.slice(note.matchText.toLowerCase().indexOf(note.matchQuery.toLowerCase())+note.matchQuery.length)}”</small>}
  <footer><div><PersonIdentity member={authorMember} name={author}/><time>{date}</time>{linkedHost&&<span>{linkedHost}</span>}</div><div className="note-editorial-actions"><EditButton label={`Edit ${note.data.title||'note'}`} onClick={event=>{event.stopPropagation();onEdit();}}/><IconButton title={`Delete ${note.data.title||'note'}`} variant="delete" onClick={event=>{event.stopPropagation();onDelete();}}>{DELETE_ICON}</IconButton></div></footer>
 </li>;
}
