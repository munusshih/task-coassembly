import test from 'node:test';
import assert from 'node:assert/strict';
import {taskWorkflowStage,taskWorkflowUpdate} from '../src/app/components/projectTaskWorkflow.mjs';
const task={memberId:'owner',links:[{url:'https://example.com'}]};
test('task stages preserve completion and review semantics',()=>{
 assert.equal(taskWorkflowStage(task),'To do');assert.equal(taskWorkflowStage({...task,completed:true}),'Ready for review');assert.equal(taskWorkflowStage({...task,reviewed:true}),'Reviewed');
 assert.equal(taskWorkflowUpdate(task,'In progress','owner').completed,false);
 assert.equal(taskWorkflowUpdate(task,'Ready for review','owner').completed,true);
});
test('task Kanban rejects other owners, locked history, missing result links and approval bypass',()=>{
 assert.throws(()=>taskWorkflowUpdate(task,'Blocked','other'),/owner/);
 assert.throws(()=>taskWorkflowUpdate({...task,reviewed:true},'To do','owner'),/locked/);
 assert.throws(()=>taskWorkflowUpdate({...task,taskWeek:'2020-01-06'},'To do','owner'),/read-only/);
 assert.throws(()=>taskWorkflowUpdate({...task,links:[]},'Ready for review','owner'),/link/);
 assert.throws(()=>taskWorkflowUpdate(task,'Reviewed','owner'),/People/);
});
