import test from 'node:test';
import assert from 'node:assert/strict';
import {continuousTimeSessions} from '../src/app/components/time/timeSessions.mjs';
const block=(id,start,end,extra={})=>({id,start,end,seconds:(end-start)/1000,source:'activity',...extra});
test('adjacent captured fragments become one selectable session without losing IDs',()=>{
 const sessions=continuousTimeSessions([block('b',900000,1800000),block('a',0,900000),block('c',1800000,2700000)]);
 assert.equal(sessions.length,1);assert.equal(sessions[0].seconds,2700);assert.deepEqual(sessions[0].fragments.map(item=>item.id),['a','b','c']);
});
test('sessions preserve gaps, source and focus ownership boundaries',()=>{
 const sessions=continuousTimeSessions([block('a',0,900000),block('b',960000,1860000),block('c',1860000,2760000,{source:'focus',taskId:'x',sessionId:'one'}),block('d',2760000,3660000,{source:'focus',taskId:'y',sessionId:'two'})]);
 assert.equal(sessions.length,4);
});
