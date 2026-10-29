"use client";
import TimeButton from "../ui/TimeButton";
import { useState } from 'react';
import { durationLabel, MIN_TRACKED_SECONDS } from './trackingModel.mjs';
import TaskClockIcon from '../ui/TaskClockIcon';

export default function UnloggedTimeList({ tracker, tasks, fragments, total, liveSeconds, onRefresh }) {
  const [selected,setSelected]=useState([]);
  const [taskId,setTaskId]=useState('');
  const chosen=fragments.filter(fragment=>selected.includes(fragment.id));
  const seconds=chosen.reduce((sum,fragment)=>sum+fragment.seconds,0);
  const incompatible=chosen.some(fragment=>fragment.taskId && fragment.taskId!==taskId);
  return <article data-rationale-anchor="unlogged-time" data-rationale-label="Unlogged time" className="time-pending-panel"><h2>Your unlogged time</h2><p className="time-pending-total"><TaskClockIcon/><strong>{durationLabel(total)}</strong><span>ready to review</span></p><p className="time-muted">Only blocks of 10 minutes or more count. Idle time stays separate.</p>
    {liveSeconds >= MIN_TRACKED_SECONDS && <p className="time-muted">{durationLabel(liveSeconds)} currently recording. Refresh to include it.</p>}
    <div className="time-pending-toolbar"><TimeButton quiet onClick={onRefresh} disabled={!tracker.owner||tracker.busy}>Refresh time</TimeButton><TimeButton quiet onClick={()=>setSelected(fragments.slice(0,100).map(fragment=>fragment.id))} disabled={!fragments.length||!tracker.owner}>Select all</TimeButton></div>
    <div className="time-pending-list" role="group" aria-label="Unlogged time blocks">{fragments.length?fragments.map(fragment=><label className="time-pending-row" key={fragment.id}><input type="checkbox" checked={selected.includes(fragment.id)} disabled={!tracker.owner||tracker.busy} onChange={event=>setSelected(previous=>event.target.checked?[...previous,fragment.id]:previous.filter(id=>id!==fragment.id))}/><span><strong>{fragment.source==='focus'?'Focus':'Activity'}</strong><small>{new Date(fragment.start).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · {new Date(fragment.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}{fragment.taskId?` · ${tasks.find(task=>task.id===fragment.taskId)?.data?.title||'Original task'}`:''}</small></span><span>{durationLabel(fragment.seconds)}</span></label>):<p className="time-muted">No blocks ready yet. They’ll appear here after ten minutes.</p>}</div>
    <label className="time-field"><span>Log to task</span><select aria-label="Log selected time to task" value={taskId} onChange={event=>setTaskId(event.target.value)} disabled={!tracker.owner||tracker.busy}><option value="">Choose a task</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.data?.title}</option>)}</select></label>
    {incompatible&&<p className="time-error">Focus time must stay with its original task.</p>}
    <TimeButton disabled={!chosen.length||chosen.length>100||!taskId||incompatible||tracker.busy||!tracker.owner} onClick={async()=>{if(await tracker.log(chosen.map(fragment=>fragment.id),taskId))setSelected([]);}}>Log {durationLabel(seconds)}</TimeButton>
  </article>;
}
