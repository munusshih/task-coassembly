'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {DayPicker} from 'react-day-picker';
import {weekForCalendarDay,weekDateLabel} from '../../lib/weekSelection.mjs';
import styles from './WeekPicker.module.css';
export default function WeekPicker({value,onChange,'aria-label':label='Choose week',disabled=false}) {
 const id=useId(),root=useRef(null),trigger=useRef(null),[open,setOpen]=useState(false);
 const from=new Date(`${value}T12:00:00`),to=new Date(from);to.setDate(to.getDate()+6);
 useEffect(()=>{if(!open)return;const dismiss=event=>{if(!root.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[open]);
 function choose(day,modifiers){if(modifiers?.disabled||modifiers?.hidden)return;onChange(weekForCalendarDay(day));setOpen(false);trigger.current?.focus();}
 return <span ref={root} className={styles.picker} onBlur={event=>{if(open&&!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
  <button ref={trigger} type="button" className={styles.trigger} aria-label={`${label}: ${weekDateLabel(value)}`} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" disabled={disabled} onClick={()=>setOpen(!open)}>{weekDateLabel(value)}<img src="/illustrations/calendar-arrow.svg" alt=""/></button>
  {open&&<span id={id} role="dialog" aria-label={label} className={styles.calendar}><DayPicker defaultMonth={from} weekStartsOn={0} showOutsideDays fixedWeeks autoFocus mode="range" selected={{from,to}} onDayClick={choose} onDayKeyDown={(day,modifiers,event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(day,modifiers);}}}/><span className={styles.hint}>Choose a day to select its Monday–Sunday week.</span></span>}
 </span>;
}
