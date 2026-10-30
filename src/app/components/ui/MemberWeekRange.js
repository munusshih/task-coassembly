'use client';
import {useState} from 'react';
import WeekSelect from './WeekSelect';
export default function MemberWeekRange({start,end,current,options,onChange}) {
 const [range,setRange]=useState(start!==end);
 const label=week=>new Date(week+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
 const endLabel=week=>{const date=new Date(week+'T12:00:00');date.setDate(date.getDate()+6);return date.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
 const groups=values=>[...new Set(values.map(value=>value.slice(0,4)))].sort().reverse().map(year=><optgroup key={year} label={year}>{values.filter(value=>value.startsWith(year)).map(value=><option value={value} key={value}>{label(value)}–{endLabel(value)}{value===current?' (current)':''}</option>)}</optgroup>);
 return <div className="member-week-controls" data-rationale-anchor="member-period" data-rationale-label="Member allocation period">
  <label className="member-period-mode"><span>Period</span><WeekSelect aria-label="Member period type" value={range?'range':'week'} onChange={event=>{const next=event.target.value==='range';setRange(next);onChange(start,next?end:start);}}><option value="week">One week</option><option value="range">Date range</option></WeekSelect></label>
  <label className="task-week-control"><span>{range?'Start week':'Week of'}</span><WeekSelect aria-label="Member start week" value={start} onChange={event=>onChange(event.target.value,range&&end>=event.target.value?end:event.target.value)}>{groups(options)}</WeekSelect></label>
  {range&&<label className="task-week-control"><span>End week (included)</span><WeekSelect aria-label="Member end week" value={end} onChange={event=>onChange(start,event.target.value)}>{groups(options.filter(value=>value>=start))}</WeekSelect></label>}
  <p className="member-period-description">Showing {label(start)}–{endLabel(end)}, {end.slice(0,4)}{range?' · both weeks and everything between':''}</p>
 </div>;
}
