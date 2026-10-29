'use client';
import { useEffect, useState } from 'react';
import { subscribeCollection } from '../../firestore';
import { firebaseReady } from '../../firebase';
import { rationaleDefaults } from './rationaleNotes.mjs';
export default function usePageRationales(pageKey,pageInfo) {
 const [saved,setSaved]=useState([]),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  setLoaded(false);setError('');
  if(!firebaseReady){setError('The shared notes are not available right now.');setLoaded(true);return;}
  return subscribeCollection('workspaceRationales',rows=>{setSaved(rows);setLoaded(true);},()=>{setError('Could not load shared notes. Please reload to try again.');setLoaded(true);});
 },[pageKey]);
 const pageNotes=saved.filter(note=>note.data.pageKey===pageKey);
 const defaults=rationaleDefaults(pageKey,pageInfo);
 const notes=[...defaults.map(note=>pageNotes.find(row=>row.id===note.id)||note),...pageNotes.filter(note=>!defaults.some(seed=>seed.id===note.id))].filter(note=>!note.data.deleted&&!note.data.archived);
 return {notes,allNotes:saved,loaded,error};
}
