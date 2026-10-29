import test from 'node:test';
import assert from 'node:assert/strict';
import {taskDecisionEntries} from '../src/app/components/taskDecisionHistory.mjs';
test('task reasons remain available after a rejected task is approved and later unlocked',()=>{
 const decisionHistory=[{action:'reject',reason:'Please link the source',createdBy:'mor',createdAt:10},{action:'approve',reason:'Source checked',createdBy:'tzu',createdAt:20}];
 const entries=taskDecisionEntries({reviewed:false,decisionHistory,reviewReason:'Source checked',rejectionReason:'Please link the source'});
 assert.equal(entries.length,2);
 assert.equal(entries[0].reason,'Please link the source');
 assert.equal(entries[1].reason,'Source checked');
 assert.equal(entries[1].createdBy,'tzu');
});
test('legacy reasons display without requiring new review events',()=>{
 assert.equal(taskDecisionEntries({reviewed:true,reviewReason:'Ready to share',reviewedAt:123})[0].reason,'Ready to share');
 assert.equal(taskDecisionEntries({rejectionReason:'Add documentation'})[0].action,'reject');
 assert.deepEqual(taskDecisionEntries({decisionHistory:[null,{action:'delete',reason:'Removed'},{action:'approve',reason:'   '}]}),[]);
});
