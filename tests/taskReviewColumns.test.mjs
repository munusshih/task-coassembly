import test from 'node:test';
import assert from 'node:assert/strict';
import {taskReviewColumns} from '../src/app/components/taskReviewColumns.mjs';
test('review columns separate unfinished, submitted, and reviewed work without duplicates',()=>{
 const tasks=[{id:'unfinished',data:{completed:false}},{id:'waiting',data:{completed:true}},{id:'approved',data:{completed:true,reviewed:true}},{id:'returned',data:{completed:false,rejectionReason:'Revise'}},{id:'legacy-reviewed',data:{reviewed:true}}];
 const columns=taskReviewColumns(tasks);
 assert.deepEqual(columns.map(column=>column.tasks.map(task=>task.id)),[['unfinished','returned'],['waiting'],['approved','legacy-reviewed']]);
 assert.equal(columns.flatMap(column=>column.tasks).length,tasks.length);
});
