'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {DayPicker} from 'react-day-picker';
import {dateKey} from '../../lib/noteCalendar.mjs';
import styles from './MemberWeekRange.module.css';
const parse=key=>new Date(`${key}T12:00:00`);
const label=key=>parse(key).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export default function MemberWeekRange({start,end,onChange}) {
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(),root=useRef(null),trigger=useRef(null),id=useId();
 useEffect(()=>{if(!open)return;const close=event=>{if(!root.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 function close(){setOpen(false);trigger.current?.focus();}
 return <div ref={root} className={styles.range} data-rationale-anchor="member-period" data-rationale-label="Member allocation period" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}}}>
  <span className={styles.label}>Date range</span><button ref={trigger} type="button" className={styles.trigger} aria-expanded={open} aria-haspopup="dialog" aria-controls={id} onClick={()=>{setDraft(undefined);setOpen(!open);}}>{label(start)}{end!==start?` – ${label(end)}`:''}<img src="/illustrations/calendar-arrow.svg" alt=""/></button>
  {open&&<div id={id} role="dialog" aria-label="Member date range" className={styles.calendar}><DayPicker mode="range" autoFocus weekStartsOn={0} showOutsideDays defaultMonth={parse(start)} selected={draft} onSelect={setDraft} numberOfMonths={1}/><p>{draft?.from?draft.to?`${label(dateKey(draft.from))} – ${label(dateKey(draft.to))}`:'Choose an end date, or apply one day.':'Choose a start date, then an end date.'}</p><div className={styles.actions}><button type="button" disabled={!draft?.from} onClick={()=>{onChange(dateKey(draft.from),dateKey(draft.to||draft.from));close();}}>Apply dates</button><button type="button" onClick={close}>Cancel</button></div></div>}
  <small>Shows weekly allocations for the weeks touching these dates.</small>
 </div>;
}
