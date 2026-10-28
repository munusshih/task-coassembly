import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyJournal, advanceJournal, closeAuto, startFocus, pauseFocus, resumeFocus, finishFocus, recoverJournal, planTimeLog, focusElapsed, workedTaskSeconds, FRAGMENT_MS, IDLE_MS } from '../src/app/components/time/trackingModel.mjs';
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
const fragment={id:'f',start:1000,end:61000,seconds:999,source:'activity'};
const task={id:'a',memberId:'me'};
test('logging recomputes duration, deduplicates selections and makes retries idempotent',()=>{
 assert.equal(planTimeLog(task,{},[fragment,fragment],'me').seconds,60);
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
