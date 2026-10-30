'use client';
import {useState} from 'react';
import {transformDocument} from '../../firestore';
import PersonIdentity from './ui/PersonIdentity';
import TextareaField from './ui/TextareaField';
import Button from './Button';
import HeadingCount from './ui/HeadingCount';
export default function NoteDiscussion({note,members,username}) {
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const comments=note?.data?.discussion||[];
 async function post(event){event.preventDefault();if(!text.trim()||busy)return;setBusy(true);setError('');try{const entry={id:crypto.randomUUID(),body:text.trim(),author:username,createdAt:Date.now()};await transformDocument('meetingNotes',note.id,data=>({discussion:[...(data.discussion||[]),entry]}));setText('');}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <section className="note-discussion"><HeadingCount title="Discussion" count={comments.length}/>{comments.map(entry=><article key={entry.id}><PersonIdentity name={entry.author} member={members.find(member=>String(member.data?.name||'').toLowerCase()===String(entry.author).toLowerCase())}><time>{new Date(entry.createdAt).toLocaleString()}</time></PersonIdentity><p>{entry.body}</p></article>)}<form onSubmit={post}><TextareaField aria-label="Discuss this note" placeholder="Ask a question or add to the discussion…" value={text} onChange={event=>setText(event.target.value)} required/><Button disabled={busy||!text.trim()}>{busy?'Posting…':'Post comment'}</Button>{error&&<p role="alert">{error}</p>}</form></section>;
}
