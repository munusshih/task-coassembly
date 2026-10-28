import test from 'node:test';
import assert from 'node:assert/strict';
import { memberRoleMetrics, workCategory } from '../src/app/components/memberRoleMetrics.mjs';
const project = (id, kind, extra = {}) => ({ id, data: { name: id, kind, ...extra } });
const task = (projectId, taskWeek, timeUnits, extra = {}) => ({ data: { type: 'memberTodo', memberId: 'm', projectId, taskWeek, timeUnits, ...extra } });
test('four-week allocation uses task weeks, includes completed work and does not count edits as new allocation', () => {
 const data = memberRoleMetrics('m', [task('a','2026-10-26',8), task('b','2026-10-19',4,{completed:true}), task('c','2026-10-12',4), task('a','2026-09-28',100,{updatedAt:Date.parse('2026-10-28')})], [project('a','Internal'),project('b','Commissioned'),project('c','Admin')], Date.parse('2026-10-28'));
 assert.equal(data.total,16);
 assert.deepEqual(data.categories.map(c=>c.percent),[50,25,25]);
 assert.deepEqual(data.weeks.map(w=>w.units),[8,4,4,0]);
});
test('current projects include active staffing and open tasks, excluding finished projects and completed tasks', () => {
 const data = memberRoleMetrics('m',[task('a','2026-10-26',4,{completed:true}),task('b','2026-10-26',4),task('c','2026-10-26',4)], [project('a','Grant'),project('b','Internal'),project('c','Admin',{status:'Completed'}),project('d','Commissioned',{staffing:[{memberId:'m'}]})], Date.parse('2026-10-28'));
 assert.deepEqual(data.currentProjects.map(p=>p.id),['b','d']);
});
test('missing categories remain explicit rather than being fabricated as R&D or commercial', () => {
 assert.equal(workCategory(''), 'unclassified');
 assert.equal(workCategory('Self-funded'), 'rd');
 assert.equal(workCategory('Pass-through'), 'work');
});
