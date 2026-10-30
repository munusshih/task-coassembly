'use client';
import {useState} from 'react';
import {transformDocument} from '../../firestore';
import DiscussionThread from './ui/DiscussionThread';
export default function NoteDiscussion({note,members,username=''}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function post(body){
  if(busy)return false;
  setBusy(true);setError('');
  try{const entry={id:crypto.randomUUID(),body,author:username,createdAt:Date.now()};await transformDocument('meetingNotes',note.id,data=>({discussion:[...(data.discussion||[]),entry]}));return true;}
  catch(err){setError(err.message);return false;}
  finally{setBusy(false);}
 }
 return <DiscussionThread entries={note?.data?.discussion||[]} members={members} username={username} onSend={post} busy={busy} error={error}/>;
}
