'use client';
import {useState} from 'react';
import TimeButton from '../ui/TimeButton';
import SelectField from '../ui/SelectField';
import FormField from '../ui/FormField';
import {durationLabel,MIN_TRACKED_SECONDS} from './trackingModel.mjs';
import TimePanel from './TimePanel';

export default function UnloggedTimeList({tracker,tasks,fragments,total,liveSeconds,onRefresh}) {
 const [selected,setSelected]=useState([]),[taskId,setTaskId]=useState('');
 const chosen=fragments.filter(fragment=>selected.includes(fragment.id));
 const seconds=chosen.reduce((sum,fragment)=>sum+fragment.seconds,0);
 const incompatible=chosen.some(fragment=>fragment.taskId&&fragment.taskId!==taskId);
 const allSelected=chosen.length>0&&chosen.length===Math.min(100,fragments.length);
 return <TimePanel anchor="unlogged-time" label="Unlogged time" title="Unlogged time" description="Review recorded blocks, then add them to a task." status={`${fragments.length} ${fragments.length===1?'block':'blocks'}`} className="time-pending-panel">
  <div className="time-pending-total"><strong>{durationLabel(total)}</strong><span>ready to log</span></div>
  <div className="time-pending-toolbar"><TimeButton quiet onClick={onRefresh} disabled={!tracker.owner||tracker.busy}>Refresh</TimeButton><TimeButton quiet onClick={()=>setSelected(allSelected?[]:fragments.slice(0,100).map(fragment=>fragment.id))} disabled={!fragments.length||!tracker.owner||tracker.busy}>{allSelected?'Clear selection':'Select all'}</TimeButton></div>
  <div className="time-pending-list" role="group" aria-label="Unlogged time blocks">{fragments.length?fragments.map(fragment=><label className="time-pending-row" key={fragment.id}><input type="checkbox" checked={selected.includes(fragment.id)} disabled={!tracker.owner||tracker.busy} onChange={event=>setSelected(previous=>event.target.checked?[...previous,fragment.id]:previous.filter(id=>id!==fragment.id))}/><span><strong>{fragment.source==='focus'?'Focus':'Activity'}</strong><small>{new Date(fragment.start).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · {new Date(fragment.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}{fragment.taskId?` · ${tasks.find(task=>task.id===fragment.taskId)?.data?.title||'Original task'}`:''}</small></span><span>{durationLabel(fragment.seconds)}</span></label>):<p className="time-panel-note">Nothing to log yet. Blocks appear here after 10 minutes.</p>}</div>
  <div className="time-panel-controls"><FormField label="Log to task"><SelectField chevron aria-label="Log selected time to task" value={taskId} onChange={event=>setTaskId(event.target.value)} disabled={!tracker.owner||tracker.busy}><option value="">Choose a task</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.data?.title}</option>)}</SelectField></FormField>
   {incompatible&&<p className="time-error" role="alert">Focus time must stay with its original task.</p>}
   <TimeButton disabled={!chosen.length||chosen.length>100||!taskId||incompatible||tracker.busy||!tracker.owner} onClick={async()=>{if(await tracker.log(chosen.map(fragment=>fragment.id),taskId))setSelected([]);}}>{tracker.busy?'Saving…':chosen.length?`Log ${durationLabel(seconds)}`:'Select time to log'}</TimeButton>
   <p className="time-panel-note">Unlogged time stays on this device. Idle time is excluded.</p>
   {liveSeconds>=MIN_TRACKED_SECONDS&&<p className="time-panel-note">{durationLabel(liveSeconds)} currently recording. Refresh to include it.</p>}
  </div>
 </TimePanel>;
}
