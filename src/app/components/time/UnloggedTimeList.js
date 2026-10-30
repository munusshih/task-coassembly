'use client';
import {useState} from 'react';
import TimeButton from '../ui/TimeButton';
import SelectField from '../ui/SelectField';
import {durationLabel} from './trackingModel.mjs';
import TimePanel from './TimePanel';
import {continuousTimeSessions} from './timeSessions.mjs';

export default function UnloggedTimeList({tracker,tasks,fragments,total}) {
 const [selected,setSelected]=useState([]),[taskId,setTaskId]=useState('');
 const sessions=continuousTimeSessions(fragments);
 const time=value=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 const day=value=>{const date=new Date(value),today=new Date(tracker.now);const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);return date.toDateString()===today.toDateString()?'Today':date.toDateString()===yesterday.toDateString()?'Yesterday':date.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
 const chosen=fragments.filter(fragment=>selected.includes(fragment.id));
 const seconds=chosen.reduce((sum,fragment)=>sum+fragment.seconds,0);
 const incompatible=chosen.some(fragment=>fragment.taskId&&fragment.taskId!==taskId);
 const allSelected=chosen.length>0&&chosen.length===Math.min(100,fragments.length);
 return <TimePanel anchor="unlogged-time" label="Unlogged time" title="Unlogged time" count={sessions.length} className="time-pending-panel">
  <div className="time-pending-total"><strong>{durationLabel(total)}</strong><span>ready to log</span></div>
  <div className="time-pending-toolbar"><TimeButton quiet onClick={()=>setSelected(allSelected?[]:fragments.slice(0,100).map(fragment=>fragment.id))} disabled={!fragments.length||!tracker.owner||tracker.busy}>{allSelected?'Clear selection':'Select all'}</TimeButton></div>
  <div className="time-pending-list" role="group" aria-label="Unlogged time blocks">{sessions.length?sessions.map(session=>{const ids=session.fragments.map(fragment=>fragment.id),checked=ids.every(id=>selected.includes(id));return <label className="time-pending-row" key={session.id}><input type="checkbox" aria-label={`Select ${day(session.start)}, ${time(session.start)} to ${time(session.end)}`} checked={checked} disabled={!tracker.owner||tracker.busy} onChange={event=>setSelected(previous=>event.target.checked?[...new Set([...previous,...ids])]:previous.filter(id=>!ids.includes(id)))}/><span><strong>{time(session.start)} to {time(session.end)}</strong><small>{day(session.start)}{day(session.start)!==day(session.end)?` to ${day(session.end)}`:''}{session.taskId?` · ${tasks.find(task=>task.id===session.taskId)?.data?.title||'Focus session'}`:''}</small></span><span>{durationLabel(session.seconds)}</span></label>;}):<p className="time-panel-note">No unlogged time yet.</p>}</div>
  <div className="time-panel-controls"><SelectField chevron aria-label="Log selected time to task" value={taskId} onChange={event=>setTaskId(event.target.value)} disabled={!tracker.owner||tracker.busy}><option value="">Choose a task</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.data?.title}</option>)}</SelectField>
   {incompatible&&<p className="time-error" role="alert">Focus time must stay with its original task.</p>}
   <TimeButton disabled={!chosen.length||chosen.length>100||!taskId||incompatible||tracker.busy||!tracker.owner} onClick={async()=>{if(await tracker.log(chosen.map(fragment=>fragment.id),taskId))setSelected([]);}}>{tracker.busy?'Saving…':chosen.length?`Log ${durationLabel(seconds)}`:'Select time to log'}</TimeButton>
  </div>
 </TimePanel>;
}
