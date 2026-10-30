import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyJournal, setAutomaticRecording, advanceJournal, closeAuto, startFocus, pauseFocus, resumeFocus, finishFocus, recoverJournal, planTimeLog, focusElapsed, workedTaskSeconds, FRAGMENT_MS, IDLE_MS } from '../src/app/components/time/trackingModel.mjs';
const step = (j, now, lastInput=0, active=true) => advanceJournal(j, now, {active,lastInput});
const seconds = (j) => j.fragments.reduce((s,f)=>s+f.seconds,0);

test('open TASK includes background time and separates idle at five minutes',()=>{
 let j=step(emptyJournal(),0);
 j=step(j,8*60000);
 assert.equal(j.fragments[0].source,'activity');
 assert.equal(j.fragments[0].seconds,300);
 assert.equal(j.auto.kind,'idle');
 assert.equal(j.auto.start,IDLE_MS);
 j=closeAuto(j,8*60000);
 assert.equal(seconds(j),480);
});
test('long visits split into selectable fifteen minute fragments without losing time',()=>{
 let j=step(emptyJournal(),0);
 j=step(j,FRAGMENT_MS*4,FRAGMENT_MS*4);
 j=closeAuto(j,FRAGMENT_MS*4+1000);
 assert.equal(seconds(j),3601);
 assert.equal(j.fragments.length,5);
});
test('leaving TASK checkpoints and stops automatic capture',()=>{
 let j=step(emptyJournal(),0);
 j=step(j,60000,0,false);
 j=step(j,3600000,0,false);
 assert.equal(j.auto,null);
 assert.equal(seconds(j),60);
});
test('recovery includes only the last persisted heartbeat, excluding browser downtime',()=>{
 let j=step(emptyJournal(),1000,1000);
 j=step(j,61000,61000);
 const recovered=recoverJournal(JSON.parse(JSON.stringify(j)));
 assert.equal(seconds(recovered),60);
 assert.equal(recovered.auto,null);
});
test('countdown ends at its deadline even when a background callback is delayed',()=>{
 let j=startFocus(emptyJournal(),1000,{taskId:'a',mode:'countdown',minutes:1,autoLog:true});
 j=step(j,121000,1000);
 assert.equal(j.focus,null);
 assert.equal(j.completion.reason,'time-up');
 assert.equal(j.completion.seconds,60);
 assert.equal(j.fragments[0].end,61000);
});
test('focus pause excludes the pause and automatic capture never overlaps focus',()=>{
 let j=step(emptyJournal(),0);
 j=startFocus(j,10000,{taskId:'a',mode:'stopwatch',minutes:25,autoLog:true});
 j=step(j,20000,20000);
 j=pauseFocus(j,20000);
 j=step(j,20000,20000);
 j=resumeFocus(j,30000);
 j=finishFocus(j,45000);
 assert.equal(j.completion.seconds,25);
 assert.equal(seconds(j),45);
 const activity=j.fragments.filter(f=>f.source!=='focus');
 const focus=j.fragments.filter(f=>f.source==='focus');
 for(const a of activity) for(const f of focus) assert.ok(a.end<=f.start || a.start>=f.end);
});
test('recovering a running focus session pauses at its last heartbeat',()=>{
 let j=startFocus(emptyJournal(),1000,{taskId:'a',mode:'stopwatch',minutes:25,autoLog:false});
 j.lastSeen=21000;
 j=recoverJournal(j);
 assert.equal(j.focus.status,'paused');
 assert.equal(j.focus.recovered,true);
 assert.equal(focusElapsed(j.focus,999999),20000);
});
const fragment={id:'f',start:1000,end:601000,seconds:999,source:'activity'};
const task={id:'a',memberId:'me'};
test('logging recomputes duration, deduplicates selections and makes retries idempotent',()=>{
 assert.equal(planTimeLog(task,{},[fragment,fragment],'me').seconds,600);
 assert.equal(planTimeLog(task,{f:{taskId:'a'}},[fragment],'me').seconds,0);
});
test('logging rejects cross-task retries, other members, archived tasks and mismatched focus fragments',()=>{
 assert.throws(()=>planTimeLog(task,{f:{taskId:'b'}},[fragment],'me'),/another task/);
 assert.throws(()=>planTimeLog(task,{},[fragment],'other'),/own task/);
 assert.throws(()=>planTimeLog({...task,archived:true},{},[fragment],'me'),/archived/);
 assert.throws(()=>planTimeLog(task,{},[{...fragment,taskId:'b',source:'focus'}],'me'),/selected task/);
});
test('malformed persisted timer state cannot break the tracker',()=>{
 const j=recoverJournal({...emptyJournal(),auto:{start:'broken'},focus:{status:'running'}});
 assert.equal(j.auto,null);
 assert.equal(j.focus,null);
});

test('actual logged time is shown without adding the planning estimate twice',()=>{
 assert.equal(workedTaskSeconds({trackedSeconds:65,timeUnits:8,completed:true}),65);
 assert.equal(workedTaskSeconds({trackedSeconds:65,timeUnits:8,completed:false}),65);
 assert.equal(workedTaskSeconds({timeUnits:8,overtimeUnits:1,completed:true}),8100);
 assert.equal(workedTaskSeconds({timeUnits:8,completed:false}),0);
});

test('unlogged blocks require ten actual minutes; idle and short blocks do not inflate totals',async()=>{
 const { eligibleTimeFragments }=await import('../src/app/components/time/trackingModel.mjs');
 const entries=[{id:'short',start:0,end:599000,seconds:9999,status:'pending',source:'activity'},{id:'ready',start:0,end:600000,status:'pending',source:'activity'},{id:'idle',start:0,end:900000,status:'pending',source:'idle'},{id:'logged',start:0,end:900000,status:'logged',source:'activity'}];
 assert.deepEqual(eligibleTimeFragments(entries).map(entry=>[entry.id,entry.seconds]),[['ready',600]]);
 assert.deepEqual(eligibleTimeFragments(entries,true).map(entry=>entry.id),['ready','idle']);
 assert.equal(planTimeLog(task,{},[entries[0]],'me').seconds,0);
 assert.equal(planTimeLog(task,{},[entries[1]],'me').seconds,600);
});

test('completion reports only logged blocks and ignores short or unrelated fragments',async()=>{
 const { recordLoggedFragments }=await import('../src/app/components/time/trackingModel.mjs');
 const focus={id:'focus',sessionId:'session',source:'focus',start:0,end:900000,seconds:900,status:'pending'};
 const short={...focus,id:'short',start:900000,end:1000000,seconds:100};
 const activity={...focus,id:'activity',sessionId:undefined,source:'activity'};
 const journal={...emptyJournal(),fragments:[focus,short,activity],completion:{id:'session',status:'pending',seconds:1000}};
 const logged=recordLoggedFragments(journal,[focus],'a');
 assert.equal(logged.completion.status,'logged');assert.equal(logged.completion.seconds,900);
 assert.equal(logged.fragments.find(f=>f.id==='short').status,'pending');
 assert.equal(recordLoggedFragments(journal,[activity],'a').completion.status,'pending');
});


test('stopping automatic recording preserves time and excludes the stopped interval after reload', () => {
 let j = step(emptyJournal(), 0);
 j = setAutomaticRecording(j, 12 * 60000, false);
 assert.equal(j.auto, null);
 assert.equal(seconds(j), 720);
 j = recoverJournal(JSON.parse(JSON.stringify(j)));
 j = step(j, 40 * 60000, 40 * 60000);
 assert.equal(j.automaticPaused, true);
 assert.equal(j.auto, null);
 j = setAutomaticRecording(j, 40 * 60000, true);
 j = step(j, 40 * 60000, 40 * 60000);
 assert.equal(j.auto.start, 40 * 60000);
 j = closeAuto(j, 51 * 60000);
 assert.equal(seconds(j), 1380);
});

test('focus sessions still run while automatic recording is stopped', () => {
 let j = setAutomaticRecording(emptyJournal(), 0, false);
 j = startFocus(j, 0, {taskId:'task-a', mode:'countdown', minutes:10, autoLog:true});
 j = step(j, 10 * 60000, 10 * 60000);
 assert.equal(j.completion.seconds, 600);
 assert.equal(j.completion.autoLog, true);
 assert.equal(j.auto, null);
});

test('eligible automatic blocks publish without refresh and reopen at the exact boundary',async()=>{
 const {refreshEligibleActivity}=await import('../src/app/components/time/trackingModel.mjs');
 let j=step(emptyJournal(),0);
 assert.equal(refreshEligibleActivity(j,599000),j);
 j=refreshEligibleActivity(j,600000);
 assert.equal(j.fragments[0].seconds,600);
 assert.equal(j.auto.start,600000);
 assert.equal(refreshEligibleActivity(j,600001).fragments.length,1);
 assert.equal(refreshEligibleActivity({...j,auto:null},1200000).auto,null);
});

test('cancelling focus keeps recorded work unlogged and never auto-logs it',async()=>{
 const {cancelFocus}=await import('../src/app/components/time/trackingModel.mjs');
 let j=startFocus(emptyJournal(),0,{taskId:'x',mode:'countdown',minutes:25,autoLog:true});
 j=cancelFocus(j,12*60000);
 assert.equal(j.focus,null);assert.equal(j.completion,null);assert.equal(j.fragments[0].seconds,720);assert.equal(j.fragments[0].status,'pending');assert.equal(j.fragments[0].autoLog,false);
});
test('dial configuration only adjusts paused timers and preserves recorded elapsed time',async()=>{
 const {configureFocus}=await import('../src/app/components/time/trackingModel.mjs');
 let j=startFocus(emptyJournal(),0,{taskId:'x',mode:'countdown',minutes:25,autoLog:true});
 assert.throws(()=>configureFocus(j,60000,{mode:'stopwatch',minutes:25}),/Pause/);
 j=pauseFocus(j,12*60000);j=configureFocus(j,12*60000,{mode:'countdown',minutes:5});
 assert.equal(j.focus.elapsedMs,12*60000);assert.equal(j.focus.durationMs,13*60000);
 j=configureFocus(j,12*60000,{mode:'stopwatch',minutes:25});assert.equal(j.focus.mode,'stopwatch');
});
