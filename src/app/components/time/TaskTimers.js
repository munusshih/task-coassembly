"use client";
import TimeButton from "../ui/TimeButton";

import UnloggedTimeList from "./UnloggedTimeList";
import CloseButton from "../ui/CloseButton";
import SelectField from "../ui/SelectField";
import InputField from "../ui/InputField";
import FormField from "../ui/FormField";
import TimePanel from "./TimePanel";

import { useEffect, useRef, useState } from "react";
import { useTaskTime } from "./TimeTrackingProvider";
import { durationLabel, focusElapsed, eligibleTimeFragments, MIN_TRACKED_SECONDS } from "./trackingModel.mjs";
import { historySegments, bandPath, historyWindow, focusAllocation } from "./dialModel.mjs";

const clockText = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};
function Dial({ now, focus, elapsed = 0, minutes, journal, onSegment, range = "today", allocations = [], tasks = [], onTask }) {
  const date = new Date(now);
  const minute = date.getMinutes() + date.getSeconds() / 60;
  const window = historyWindow(now, range);
  const markerPosition = range === "today" ? (now - window.start) / window.cycle : minute / 60;
  const markerAngle = markerPosition * Math.PI * 2 - Math.PI / 2;
  const markerX = 100 + Math.cos(markerAngle) * 94;
  const markerY = 100 + Math.sin(markerAngle) * 94;
  const isTimer = Boolean(focus || minutes);
  const progress = focus ? (focus.mode === "countdown" ? elapsed / focus.durationMs : (elapsed % 3600000) / 3600000) : 0;
  const handAngle = (isTimer ? Math.min(1, Math.max(0, progress)) : markerPosition) * 360;
  const segments = journal ? historySegments(journal, now, range).filter(entry=>entry.status === "logged" || (entry.source!=="idle" && entry.seconds>=MIN_TRACKED_SECONDS)) : [];
  const recorded = segments.reduce((sum, entry) => sum + entry.seconds, 0);
  const readoutLabel=isTimer?(focus?focus.status==="paused"?"Paused":focus.mode==="countdown"?"Remaining":"Elapsed":"Ready to focus"):"Local time";
  const sourceLabel = (entry) => entry.status === "logged" ? "Logged" : entry.source === "idle" ? "Idle" : entry.source === "focus" ? "Focus" : "Activity";
  return <div className={`time-dial ${isTimer ? "time-dial--focus" : ""}`}>
    <svg viewBox="0 0 200 200" aria-label={isTimer ? "Focus progress" : `Current time ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, with ${range === "today" ? "today’s activity" : "activity over the last hour"}`} role="group">
      <desc>{isTimer ? "The filled sector shows elapsed session time. Inner segments show focus time by task today; select a segment to choose its task." : `${durationLabel(recorded)} tracked ${range === "today" ? "today" : "over the last hour"}. The selected scale shows the recorded activity for that range. Solid sectors are unlogged; muted sectors are logged. The tapered hand marks now.`}</desc>
      {isTimer ? <circle cx="100" cy="100" r="94" className="time-history-track" aria-hidden="true" /> : <circle cx="100" cy="100" r="94" className="time-orbit-face" aria-hidden="true" />}
      {!isTimer&&<g className="time-dial-scale" aria-hidden="true"><text x="100" y="23" textAnchor="middle">00</text><text x="178" y="102" textAnchor="middle">{range==="today"?"06":"15"}</text><text x="100" y="184" textAnchor="middle">{range==="today"?"12":"30"}</text><text x="22" y="102" textAnchor="middle">{range==="today"?"18":"45"}</text></g>}
      <g className="time-disc-ticks" aria-hidden="true">{Array.from({length:24},(_,index)=><line key={index} x1="100" y1={index%6===0?"9":"8"} x2="100" y2={index%6===0?"15":"11"} transform={`rotate(${index*15} 100 100)`}/>)}</g>
      {isTimer ? <>
        {progress > 0 ? <path d={bandPath(0, Math.min(1,progress), 90, 8)} className="time-disc-progress" aria-hidden="true" /> : null}
        {allocations.map((entry) => {
          const task = tasks.find((task) => task.id === entry.taskId);
          const label = `${task?.data.title || "Unavailable task"} · ${durationLabel(entry.seconds)} focus today`;
          return <path key={entry.taskId} d={bandPath(entry.position, entry.span, 82, 76)} className={`time-task-allocation time-task-allocation--${[...entry.taskId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4}`} role={task && onTask ? "button" : "img"} tabIndex={task && onTask ? 0 : undefined} aria-label={label} onClick={task && onTask ? () => onTask(entry.taskId) : undefined} onKeyDown={task && onTask ? (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); onTask(entry.taskId); } } : undefined}><title>{label}</title></path>;
        })}
      </> : <g>
        {segments.map((entry) => {
          const canReview = entry.status === "pending" && !entry.live && Boolean(onSegment);
          const label = `${sourceLabel(entry)} · ${durationLabel(entry.seconds)}${canReview ? " · review fragment" : ""}`;
          return <path key={entry.id} d={bandPath(entry.position, entry.span, 90, 8)} className={`time-orbit-sector time-orbit-sector--${entry.status === "logged" ? "logged" : entry.source} ${canReview ? "is-interactive" : ""}`} role={canReview ? "button" : "img"} aria-hidden={entry.status === "logged" || entry.live ? true : undefined} aria-label={label} tabIndex={canReview ? 0 : undefined} onClick={canReview ? () => onSegment(entry.id) : undefined} onKeyDown={canReview ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSegment(entry.id); } } : undefined}><title>{label}</title></path>;
        })}

      </g>}
      <g className="time-disc-pointer" aria-hidden="true" transform={`rotate(${handAngle} 100 100)`}><path d="M98 100 L100 19 L107 101 L100 110 Z"/></g>
      <circle className="time-disc-hub" cx="100" cy="100" r="2.5" aria-hidden="true"/>
      {focus ? <>
        <text x="100" y="157" className="time-dial-digits" textAnchor="middle">{clockText(focus.mode === "countdown" ? focus.durationMs - elapsed : elapsed)}</text>
      </> : minutes ? <>
        <text x="100" y="157" className="time-dial-digits" textAnchor="middle">{minutes}</text>
      </> : <>

        <text x="100" y="157" textAnchor="middle" className="time-dial-digits time-orbit-time">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</text>
        <circle cx={markerX} cy={markerY} r="2.5" className="time-orbit-marker" aria-hidden="true" />
      </>}
      <text x="100" y="171" textAnchor="middle" className="time-dial-caption">{readoutLabel}</text>

    </svg>
  </div>;
}

function ReviewTime({ tracker, tasks, initial, onClose }) {
  const [selected, setSelected] = useState(() => initial.filter((f) => f.explicit || f.source !== "idle").slice(0, 100).map((f) => f.id));
  const [taskId, setTaskId] = useState(() => initial.find((f) => f.taskId)?.taskId || tasks[0]?.id || "");
  const dialogRef = useRef(null);
  const fragments = eligibleTimeFragments(tracker.journal.fragments);
  const chosen = fragments.filter((f) => selected.includes(f.id));
  const incompatible = chosen.some((f) => f.taskId && f.taskId !== taskId);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector("button")?.focus();
    const key = (event) => {
      if (event.key === "Escape" && !tracker.busy) onClose();
      if (event.key === "Tab") {
        const nodes = [...dialog.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]')];
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    dialog?.addEventListener("keydown", key);
    return () => { dialog?.removeEventListener("keydown", key); previous?.focus(); };
  }, [tracker.busy, onClose]);
  const time = (value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return <div className="edit-modal-overlay">
    <div className="edit-modal time-review" role="dialog" aria-modal="true" aria-labelledby="time-review-title" ref={dialogRef}>
      <div className="edit-modal-header"><span className="edit-modal-title" id="time-review-title">Review your time</span><CloseButton className="edit-modal-close" onClick={onClose} label="Close time review" disabled={tracker.busy}/></div>
      <div className="edit-modal-body">
        <p className="time-muted">Select worked blocks of at least ten minutes. Focus time stays with its task.</p>
        <label className="time-field">Log to task<SelectField chevron value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={tracker.busy}><option value="">Choose a task</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.data.title}</option>)}</SelectField></label>
        <div className="time-fragments">
          {fragments.length ? fragments.map((f) => <label className={`time-fragment ${f.source === "idle" ? "time-fragment--idle" : ""}`} key={f.id}>
            <input type="checkbox" checked={selected.includes(f.id)} disabled={tracker.busy} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, f.id] : ids.filter((id) => id !== f.id))} />
            <span><strong>{f.source === "focus" ? "Focus" : f.source === "idle" ? "Idle" : "Activity"}</strong><small>{new Date(f.start).toLocaleDateString([], { month: "short", day: "numeric" })} · {time(f.start)}–{time(f.end)}{f.taskId ? ` · ${tasks.find((t) => t.id === f.taskId)?.data.title || "Original task unavailable"}` : ""}</small></span>
            <span>{durationLabel(f.seconds)}</span>
          </label>) : <p>No unlogged time yet.</p>}
        </div>
        {incompatible ? <p className="time-error" role="alert">Select focus fragments for one task at a time, and choose their original task.</p> : null}
        {tracker.error ? <p className="time-error" role="alert">{tracker.error}</p> : null}
        <p className="time-muted">Unlogged time stays on this device.</p>
      </div>
      <div className="edit-modal-footer time-review-footer">
        <TimeButton quiet disabled={!chosen.length || tracker.busy || !tracker.owner} onClick={() => { tracker.discard(selected); setSelected([]); }}>Discard selected</TimeButton>
        <TimeButton disabled={!chosen.length || chosen.length > 100 || !taskId || incompatible || tracker.busy || !tracker.owner} onClick={async () => { if (await tracker.log(selected, taskId)) onClose(); }}>{tracker.busy ? "Saving…" : `Log ${durationLabel(chosen.reduce((n, f) => n + f.seconds, 0))}`}</TimeButton>
      </div>
    </div>
  </div>;
}

export default function TaskTimers({ tasks }) {
  const tracker = useTaskTime();
  const [mode, setMode] = useState("countdown");
  const [range, setRange] = useState("today");
  const [minutes, setMinutes] = useState(25);
  const [taskId, setTaskId] = useState("");
  const [autoLog, setAutoLog] = useState(true);
  const [review, setReview] = useState(null);
  if (!tracker) return null;
  const { journal, now, owner, busy } = tracker;
  const focus = journal.focus;
  const elapsed = focusElapsed(focus, now);
  const pending = eligibleTimeFragments(journal.fragments);
  const liveSeconds = journal.auto?.kind === "activity" ? Math.floor((now-journal.auto.start)/1000) : 0;
  const total = pending.reduce((sum,f)=>sum+f.seconds,0);
  const selectedTask = focus?.taskId || taskId || tasks[0]?.id || "";
  const allocations = focusAllocation(journal, now);
  const selectTask = (id) => {
    if (!owner || busy || id === selectedTask) return;
    if (focus) tracker.finish();
    setTaskId(id);
  };
  const openReview = (id) => { const entries = tracker.checkpoint(); setReview(typeof id === "string" ? entries.filter((entry) => entry.id === id).map((entry) => ({ ...entry, explicit: true })) : entries); tracker.snooze(); };
  const completion = journal.completion;
  return <>
    {!owner&&<p className="time-tracking-handoff" role="status">Time tracking is active in another Protocol tab. Use that tab to start focus or log time.</p>}
    <section className="task-timers" aria-label="Time tracking">
      <TimePanel anchor="automatic-clock" label="Automatic clock" title="Automatic" description="Records activity while Protocol is open." status={!owner?'Another tab':focus?.status==='running'?'Focus is running':'Recording'} active={owner} className="time-panel--automatic">
        <div className="time-panel-dial"><Dial now={now} journal={journal} onSegment={owner ? openReview : null} range={range}/></div>
        <div className="time-panel-controls">
          <FormField label="Activity shown"><SelectField chevron aria-label="Automatic clock range" value={range} onChange={event=>setRange(event.target.value)}><option value="today">Today · 24 hours</option><option value="hour">Last hour · 60 minutes</option></SelectField></FormField>
          <div className="time-dial-legend"><span><i/>Unlogged</span><span><i/>Logged</span></div>
          <p className="time-panel-note">Select an unlogged area to review it. Idle time and blocks under 10 minutes stay out of your total.</p>
        </div>
      </TimePanel>
      <TimePanel anchor="focus-clock" label="Focus clock" title="Focus" description="Choose a task and make some room for it." status={focus?focus.status==='paused'?'Paused':'Running':'Ready'} active={focus?.status==='running'} className="time-panel--focus">
        <div className="time-panel-dial"><Dial now={now} focus={focus} elapsed={elapsed} allocations={allocations} tasks={tasks} onTask={owner&&!busy?selectTask:null} minutes={!focus?mode==='countdown'?clockText(Number(minutes||25)*60000):'00:00':null}/>{focus&&<span className="time-focus-readout" role="timer" aria-live="off">{clockText(focus.mode==='countdown'?focus.durationMs-elapsed:elapsed)} {focus.status==='paused'?'paused':focus.mode==='countdown'?'remaining':'elapsed'}</span>}</div>
        <div className="time-panel-controls time-focus-controls">
          <FormField label="Task"><SelectField chevron aria-label="Focus task" title={focus?'Choosing another task finishes this session and keeps its time with the original task.':'Choose a task to focus on'} value={selectedTask} onChange={event=>selectTask(event.target.value)} disabled={!owner||busy}>{focus&&!tasks.some(task=>task.id===focus.taskId)&&<option value={focus.taskId}>Current task unavailable — finish or switch</option>}{!tasks.length&&!focus?<option value="">No open tasks</option>:tasks.map(task=><option key={task.id} value={task.id}>{task.data.title}{allocations.find(entry=>entry.taskId===task.id)?` · ${durationLabel(allocations.find(entry=>entry.taskId===task.id).seconds)} today`:''}</option>)}</SelectField></FormField>
          <div className="time-focus-options"><FormField label="Timer"><SelectField chevron aria-label="Focus timer mode" value={focus?.mode||mode} onChange={event=>setMode(event.target.value)} disabled={Boolean(focus)||!owner||busy}><option value="countdown">Countdown</option><option value="stopwatch">Stopwatch</option></SelectField></FormField>{(focus?.mode||mode)==='countdown'&&<FormField label="Duration"><span className="time-duration-field"><InputField aria-label="Focus minutes" type="number" min="1" max="240" value={focus?focus.durationMs/60000:minutes} onChange={event=>setMinutes(event.target.value)} disabled={Boolean(focus)||!owner||busy}/><span>min</span></span></FormField>}</div>
          <label className="time-auto-log"><input type="checkbox" checked={focus?.autoLog??autoLog} onChange={event=>setAutoLog(event.target.checked)} disabled={Boolean(focus)||!owner||busy}/>Log to this task when finished</label>
          {focus?.recovered&&<p className="time-panel-note">Paused when Protocol closed. Resume when ready.</p>}
          {!focus&&mode==='countdown'&&Number(minutes)<10&&<p className="time-panel-note">Sessions under 10 minutes won’t be added to logged time.</p>}
          <div className="time-actions">{focus?<><TimeButton quiet onClick={focus.status==='running'?tracker.pause:tracker.resume} disabled={!owner||busy}>{focus.status==='running'?'Pause':'Resume'}</TimeButton><TimeButton onClick={tracker.finish} disabled={!owner||busy}>Finish &amp; {focus.autoLog?'log':'review'}</TimeButton></>:<TimeButton disabled={!selectedTask||!owner||busy||(mode==='countdown'&&(!Number.isFinite(Number(minutes))||Number(minutes)<1||Number(minutes)>240))} onClick={()=>tracker.start({taskId:selectedTask,mode,minutes:Number(minutes),autoLog})}>Start focus</TimeButton>}</div>
        </div>
      </TimePanel>
      <UnloggedTimeList tracker={tracker} tasks={tasks} fragments={pending} total={total} liveSeconds={liveSeconds} onRefresh={()=>tracker.checkpoint()}/>
    </section>
    {tracker.error && !review ? <p className="time-error" role="alert">{tracker.error}</p> : null}
    {completion ? <div className="time-notice" role="alert"><span><strong>{completion.reason === "time-up" ? "Time’s up." : "Session complete."}</strong> {durationLabel(completion.seconds)} {completion.status === "logged" ? "logged to your task." : ["empty","too-short"].includes(completion.status) ? "— no blocks of ten minutes to count." : busy ? "— saving to your task…" : "ready to log."}</span><div className="time-actions">{completion.reason === "time-up" ? <TimeButton quiet disabled={!owner || busy} onClick={() => tracker.start({ taskId: completion.taskId, mode: "stopwatch", minutes: 25, autoLog: completion.autoLog })}>Keep going</TimeButton> : null}{completion.status === "pending" ? <TimeButton quiet onClick={openReview} disabled={!owner || busy}>Review & log</TimeButton> : null}<TimeButton quiet onClick={tracker.dismiss} disabled={!owner || busy}>Dismiss</TimeButton></div></div> : null}
    {review ? <ReviewTime tracker={tracker} tasks={tasks} initial={review} onClose={() => setReview(null)} /> : null}
  </>;
}
