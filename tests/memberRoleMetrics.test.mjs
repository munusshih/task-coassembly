import test from 'node:test';
import assert from 'node:assert/strict';
import { memberRoleMetrics, workCategory, projectWorkTone } from '../src/app/components/memberRoleMetrics.mjs';
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

test('project categories and labels stay consistent in current and historical views', () => {
 const data = memberRoleMetrics('m', [task('a', '2026-10-26', 8)], [project('a', 'Commissioned')], Date.parse('2026-10-28'));
 assert.equal(data.categories.find(category => category.key === 'work').label, 'Work');
 const current = data.currentProjects[0];
 const history = data.weeks[0].projects[0];
 assert.equal(projectWorkTone(current.data.kind), projectWorkTone(history.kind));
 assert.equal(history.units, 8);
});

test('weekly and overall allocation share categories but use distinct task-week windows',()=>{
 const tasks=[task('a','2026-10-26',8,{completed:true}),task('b','2026-10-19',4),task('a','2026-04-20',12)];
 const projects=[project('a','Internal'),project('b','Commissioned')];
 const now=Date.parse('2026-10-28');
 const weekly=memberRoleMetrics('m',tasks,projects,now,'weekly');
 const overall=memberRoleMetrics('m',tasks,projects,now,'overall');
 assert.equal(weekly.total,8);assert.equal(weekly.assigned,1);assert.equal(weekly.completed,1);
 assert.equal(overall.total,24);assert.equal(overall.assigned,3);assert.equal(overall.completed,1);
 assert.deepEqual(overall.projectTotals.map(p=>[p.id,p.units]),[['a',20],['b',4]]);
 assert.equal(weekly.categories.find(category=>category.key==='rd').percent,100);
});

test('selected weekly periods include both boundary weeks and exclude surrounding allocation', () => {
 const tasks = [task('a','2026-10-26',8),task('a','2026-10-19',12,{completed:true}),task('b','2026-10-12',4),task('b','2026-10-05',100)];
 const projects = [project('a','Internal'),project('b','Commissioned')];
 const now = Date.parse('2026-10-29');
 const range = memberRoleMetrics('m',tasks,projects,now,'weekly',{start:'2026-10-12',end:'2026-10-19'});
 assert.equal(range.total,16);
 assert.equal(range.assigned,2);
 assert.equal(range.completed,1);
 assert.deepEqual(range.weeks.map(week => week.key),['2026-10-19','2026-10-12']);
 const single = memberRoleMetrics('m',tasks,projects,now,'weekly',{start:'2026-10-12'});
 assert.equal(single.total,4);
 assert.equal(single.categories.find(category => category.key === 'work').percent,100);
 const overall = memberRoleMetrics('m',tasks,projects,now,'overall',{start:'2026-10-12',end:'2026-10-19'});
 assert.equal(overall.total,124);
});

test('arbitrary date ranges include intersecting allocation weeks without losing non-Monday boundaries',()=>{
 const tasks=[task('a','2026-10-19',4),task('a','2026-10-26',8),task('a','2026-11-02',16)];
 const range=memberRoleMetrics('m',tasks,[project('a','Internal')],Date.parse('2026-10-30'),'weekly',{start:'2026-10-22',end:'2026-10-29'});
 assert.equal(range.total,12);
 assert.deepEqual(range.weeks.map(week=>week.key),['2026-10-26','2026-10-19']);
 const single=memberRoleMetrics('m',tasks,[project('a','Internal')],Date.parse('2026-10-30'),'weekly',{start:'2026-10-25',end:'2026-10-25'});
 assert.equal(single.total,4);
});
