import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTimeProgress} from '../src/app/components/projectProgress.mjs';
const task = data => ({data:{projectId:'p',...data}});
test('folder progress compares recorded time without treating completed estimates as logs with allocated time',()=>{
 const progress=projectTimeProgress('p',[task({timeUnits:8,trackedSeconds:3600}),task({timeUnits:4,completed:true}),task({timeUnits:20,archived:true}),task({projectId:'other',timeUnits:20})]);
 assert.deepEqual(progress,{allocatedSeconds:10800,loggedSeconds:3600,percent:33,fill:33});
});
test('folder progress caps the fill while retaining overtime and handles zero allocation',()=>{
 assert.deepEqual(projectTimeProgress('p',[task({timeUnits:4,trackedSeconds:7200})]),{allocatedSeconds:3600,loggedSeconds:7200,percent:200,fill:100});
 assert.deepEqual(projectTimeProgress('p',[]),{allocatedSeconds:0,loggedSeconds:0,percent:0,fill:0});
});

test('project visualizations share total capacity instead of using allocation as the denominator',async()=>{
 const {projectCapacityProgress}=await import('../src/app/components/projectProgress.mjs');
 const result=projectCapacityProgress({id:'p',data:{maxHours:100}},[task({timeUnits:200,trackedSeconds:25*3600})]);
 assert.equal(result.capacitySeconds,100*3600);
 assert.equal(result.capacityFill,100);
 assert.equal(result.allocatedFill,50);
 assert.equal(result.loggedFill,25);
 assert.equal(result.capacityPercent,25);
 const unknown=projectCapacityProgress({id:'p',data:{}},[]);
 assert.equal(unknown.capacitySeconds,null);
 assert.equal(unknown.capacityPercent,null);
});
test('logged percentages use explicit records, stay above 100%, and reject invalid quantities',()=>{
 const progress=projectTimeProgress('p',[task({timeUnits:4,trackedSeconds:9000}),task({timeUnits:-4,trackedSeconds:-900}),task({timeUnits:Infinity,trackedSeconds:Infinity}),task({timeUnits:4,completed:true,trackedSeconds:0})]);
 assert.deepEqual(progress,{allocatedSeconds:7200,loggedSeconds:9000,percent:125,fill:100});
});
