'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {dateKey} from '../../lib/noteCalendar.mjs';
import {DayPicker} from 'react-day-picker';
import styles from './DateField.module.css';
const parse=value=>value?new Date(`${value}T12:00:00`):undefined;
export default function DateField({value='',onChange,onInput,onBlur,onClick,disabled,readOnly,min,max,required,name,id,className='',style,placeholder='Choose date',title,'aria-label':ariaLabel,autoFocus}) {
 const popup=useRef(null),trigger=useRef(null),uid=useId(),[open,setOpen]=useState(false);
 function place(){const rect=trigger.current?.getBoundingClientRect();if(!rect||!popup.current)return;const width=320,height=Math.min(popup.current.getBoundingClientRect().height||440,window.innerHeight-32);popup.current.style.left=`${Math.max(16,Math.min(rect.left,window.innerWidth-width-16))}px`;popup.current.style.top=`${Math.max(16,rect.bottom+height>window.innerHeight?rect.top-height-8:rect.bottom+8)}px`;}
 useEffect(()=>{if(!open){popup.current?.hidePopover();return;}popup.current?.showPopover();place();const locked=[];for(let node=trigger.current?.parentElement;node;node=node.parentElement){if(node===document.body||/(auto|scroll)/.test(getComputedStyle(node).overflowY)){locked.push([node,node.style.overflowY]);node.style.overflowY='hidden';}}const update=()=>place();window.addEventListener('resize',update);return()=>{for(const [node,overflow] of locked)node.style.overflowY=overflow;window.removeEventListener('resize',update);};},[open]);
 function close(){popup.current?.hidePopover();setOpen(false);trigger.current?.focus();}
 function choose(day){if(!day)return;onChange?.({target:{value:dateKey(day),name}});close();}
 return <span className={styles.field}>
  <button ref={trigger} id={id} type="button" title={title} className={`field-input ${styles.trigger} ${className}`} style={style} disabled={disabled} autoFocus={autoFocus} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={uid} onBlur={()=>onBlur?.({target:{value,name}})} onClick={event=>{onClick?.(event);if(!readOnly&&!event.defaultPrevented)setOpen(!open);}}><span>{value?parse(value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):placeholder}</span><img src="/illustrations/calendar-arrow.svg" alt=""/></button>
  <input type="date" className="sr-only" tabIndex={-1} aria-hidden="true" name={name} value={value} required={required} min={min} max={max} disabled={disabled} onChange={()=>{}} onInvalid={event=>{event.preventDefault();trigger.current?.focus();setOpen(true);}}/>
  <span ref={popup} id={uid} popover="auto" role="dialog" aria-label={ariaLabel||title||'Choose date'} className={styles.calendar} onToggle={event=>{if(event.newState==='closed')setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
   {open&&<><DayPicker mode="single" autoFocus selected={parse(value)} defaultMonth={parse(value)||new Date()} onSelect={choose} weekStartsOn={0} showOutsideDays captionLayout="dropdown" startMonth={new Date(1900,0)} endMonth={new Date(2100,11)} disabled={[...(min?[{before:parse(min)}]:[]),...(max?[{after:parse(max)}]:[])]}/><div className={styles.actions}>{!required&&value&&<button type="button" onClick={()=>{onChange?.({target:{value:'',name}});close();}}>Clear date</button>}<button type="button" onClick={close}>Close</button></div></>}
  </span>
 </span>;
}
