'use client';
import {useEffect} from 'react';
/** Keep programmatic calendar focus from drawing keyboard rings after a pointer click. */
export default function FocusModality(){
 useEffect(()=>{
  const root=document.documentElement;
  root.dataset.inputModality='pointer';
  const pointer=()=>{root.dataset.inputModality='pointer';};
  const keyboard=event=>{if(['Tab','Enter',' ','Escape','Home','End','PageUp','PageDown','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))root.dataset.inputModality='keyboard';};
  document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',keyboard,true);
  return()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',keyboard,true);delete root.dataset.inputModality;};
 },[]);
 return null;
}
