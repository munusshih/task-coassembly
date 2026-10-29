"use client";
import { useState } from "react";
import { dateKey, monthDays, shiftMonth } from "../lib/noteCalendar.mjs";
import Button from "./Button";

export default function NotesCalendar({ notes, renderNotes, onOpenNote }) {
  const today=dateKey(Date.now());
  const [month,setMonth]=useState(today.slice(0,7));
  const [selected,setSelected]=useState(null);
  const byDay=new Map();
  notes.forEach(note=>{const day=dateKey(note.data?.createdAt);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(note);});
  const visible=notes.filter(note=>selected?dateKey(note.data?.createdAt)===selected:dateKey(note.data?.createdAt).startsWith(month));
  const label=new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const go=amount=>{setMonth(shiftMonth(month,amount));setSelected(null);};
  return <section className="notes-calendar" aria-label="Notes calendar">
    <div className="notes-calendar-heading"><h2>{label}</h2><div><Button aria-label="Previous month" onClick={()=>go(-1)}>←</Button><Button onClick={()=>{setMonth(today.slice(0,7));setSelected(today);}}>Today</Button><Button aria-label="Next month" onClick={()=>go(1)}>→</Button></div></div>
    <div className="notes-calendar-grid" role="group" aria-label={label}>
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><div className="notes-calendar-weekday" key={day}>{day}</div>)}
      {monthDays(month).map(day=><div key={day} className={`notes-calendar-day ${day.startsWith(month)?'':'is-outside'} ${selected===day?'is-selected':''} ${day===today?'is-today':''}`}>
        <button className="notes-calendar-date" aria-label={`${day}, ${(byDay.get(day)||[]).length} notes`} aria-pressed={selected===day} onClick={()=>{setMonth(day.slice(0,7));setSelected(selected===day?null:day);}}><span>{Number(day.slice(-2))}</span>{byDay.has(day)&&<span className="count-badge">{byDay.get(day).length}</span>}</button>
        <div className="notes-calendar-events">{(byDay.get(day)||[]).slice(0,3).map(note=><button key={note.id} onClick={()=>onOpenNote(note)} title={note.data?.title}>{note.data?.title || 'Untitled'}</button>)}{(byDay.get(day)||[]).length>3&&<button onClick={()=>setSelected(day)}>+{byDay.get(day).length-3} more</button>}</div>
      </div>)}
    </div>
    <div className="notes-calendar-selection" aria-live="polite">{visible.length?renderNotes(selected?new Date(`${selected}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):label,visible):<p>No notes {selected?'on this day':'this month'}.</p>}</div>
  </section>;
}
