import test from 'node:test';
import assert from 'node:assert/strict';
import { historySegments, arcPath, bandPath, historyWindow, focusAllocation, HISTORY_MS } from '../src/app/components/time/dialModel.mjs';
import { emptyJournal } from '../src/app/components/time/trackingModel.mjs';
const now = Date.UTC(2026,9,18,12,30);
const fragment=(id,start,end,extra={})=>({id,start,end,source:'activity',status:'pending',...extra});
test('history shows only the most recent hour, clipping old and future portions',()=>{
 const entries=historySegments({...emptyJournal(),fragments:[fragment('old',now-HISTORY_MS*2,now-HISTORY_MS-1),fragment('clipped',now-HISTORY_MS*2,now-1000),fragment('future',now-1000,now+60000)]},now);
 assert.equal(entries.length,2);
 assert.equal(entries[0].seconds,3599);
 assert.equal(entries[1].seconds,1);
 assert.ok(entries.every(e=>e.span>0 && e.span<=1 && e.position>=0 && e.position<1));
});
test('discarded fragments are absent; pending and logged retain their ring status',()=>{
 const entries=historySegments({...emptyJournal(),fragments:[fragment('pending',now-60000,now),fragment('logged',now-120000,now-60000,{status:'logged'}),fragment('discarded',now-180000,now-120000,{status:'discarded'})]},now);
 assert.deepEqual(entries.map(e=>e.status),['pending','logged']);
});
test('live idle capture and focus runs are represented without fabricating pause time',()=>{
 const j={...emptyJournal(),auto:{id:'idle',kind:'idle',start:now-60000},focus:{id:'focus',status:'paused',runs:[{start:now-180000,end:now-120000}]}};
 const entries=historySegments(j,now);
 assert.equal(entries.length,2);
 assert.equal(entries.reduce((sum,e)=>sum+e.seconds,0),120);
 assert.deepEqual(entries.map(e=>e.source),['idle','focus']);
 assert.ok(entries.every(e=>e.live));
});
test('a segment crossing the hour preserves its duration and a whole hour draws a complete ring',()=>{
 const entries=historySegments({...emptyJournal(),fragments:[fragment('crossing',Date.UTC(2026,9,18,11,55),Date.UTC(2026,9,18,12,5))]},now);
 assert.equal(entries[0].seconds,600);
 assert.equal(entries[0].span,1/6);
 assert.equal((arcPath(.9,1,94).match(/ A /g)||[]).length,2);
 assert.equal(arcPath(0,0,94),'');
 assert.ok(!arcPath(.5,.25,94).includes('NaN'));
});
test('the history ring never paints focus time past a countdown deadline',()=>{
 const entries=historySegments({...emptyJournal(),focus:{id:'focus',mode:'countdown',status:'running',startedAt:now-120000,durationMs:60000,elapsedMs:0,runs:[]}},now);
 assert.equal(entries[0].seconds,60);
 assert.equal(entries[0].end,now-60000);
});

test('disc sectors remain hollow across the hour boundary and for a complete hour',()=>{
 const partial=bandPath(.95,.1,94,48);
 assert.equal((partial.match(/ A /g)||[]).length,2);
 assert.ok(partial.includes('A 48 48 0 0 0'));
 assert.equal((bandPath(.2,1,94,48).match(/ A /g)||[]).length,4);
 assert.ok(!bandPath(.95,.1,94,48).includes('NaN'));
 assert.equal(bandPath(0,0,94,48),'');
});

test('Today preserves a multi-hour interval rather than clipping it to one hour',()=>{
 const at=new Date(2026,9,18,16).getTime();
 const start=new Date(2026,9,18,8).getTime();
 const end=new Date(2026,9,18,12).getTime();
 const j={...emptyJournal(),fragments:[fragment('long',start,end)]};
 assert.equal(historySegments(j,at).length,0);
 const entries=historySegments(j,at,'today');
 assert.equal(entries[0].seconds,4*3600);
 assert.equal(entries[0].span,4*3600000/historyWindow(at,'today').cycle);
});
test('Today clips at local midnight while preserving historical fragments in the journal',()=>{
 const at=new Date(2026,9,18,2).getTime();
 const midnight=new Date(2026,9,18,0).getTime();
 const j={...emptyJournal(),fragments:[fragment('cross',midnight-3600000,midnight+3600000)]};
 const entries=historySegments(j,at,'today');
 assert.equal(entries[0].seconds,3600);
 assert.equal(entries[0].position,0);
 assert.equal(j.fragments[0].end-j.fragments[0].start,7200000);
});
test('focus allocation groups real focused time by task, including the current session',()=>{
 const at=new Date(2026,9,18,12).getTime();
 const j={...emptyJournal(),fragments:[fragment('a',at-600000,at-540000,{source:'focus',taskId:'a',status:'logged'}),fragment('b',at-540000,at-420000,{source:'focus',taskId:'b'}),fragment('auto',at-420000,at-360000)],focus:{id:'live',taskId:'a',status:'running',mode:'stopwatch',startedAt:at-60000,runs:[]}};
 const slices=focusAllocation(j,at);
 assert.deepEqual(slices.map(s=>[s.taskId,s.seconds]),[['a',120],['b',120]]);
 assert.equal(slices[0].span,.5);
 assert.equal(slices[1].position,.5);
});
