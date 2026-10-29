import test from 'node:test';
import assert from 'node:assert/strict';
import { groupProjects, groupWishes, projectStatusColumns } from '../src/app/components/workspaceGroups.mjs';
const projects=[{id:'a',data:{name:'Studio',kind:'Internal',status:'Active'}},{id:'b',data:{name:'Client',kind:'Commissioned',status:'Completed'}},{id:'c',data:{name:'Admin',kind:'Admin',status:'Active'}}];
test('projects group consistently by work category or status without hiding records',()=>{
 assert.deepEqual(groupProjects(projects).map(group=>[group.title,group.projects.length]),[['R&D',1],['Work',1],['Admin',1]]);
 assert.deepEqual(groupProjects(projects,'status').map(group=>[group.title,group.projects.length]),[['Active',2],['Completed',1]]);
});
test('wishes keep archival state and original project membership when grouped by date',()=>{
 const items=[{id:'1',data:{projectId:'a',createdAt:Date.parse('2026-10-20T12:00:00Z')}},{id:'2',data:{projectId:'b',createdAt:Date.parse('2026-10-21T12:00:00Z'),archived:true}},{id:'3',data:{createdAt:null}}];
 const date=groupWishes(items,projects,'date');
 assert.equal(date.find(group=>group.id==='2026-10').items[0].data.projectId,'a');
 assert.equal(date.find(group=>group.id==='2026-10').archivedItems[0].data.projectId,'b');
 assert.ok(date.find(group=>group.id==='undated'));
 const byProject=groupWishes(items,projects);
 assert.equal(byProject.find(group=>group.id==='a').project.id,'a');
 assert.ok(byProject.find(group=>group.id==='unassigned'));
});

test('Kanban columns retain empty stages, unknown statuses and every project exactly once',()=>{
 const columns=projectStatusColumns([...projects,{id:'d',data:{name:'Unset'}}],['Scheduled','Active','Completed']);
 assert.deepEqual(columns.map(column=>[column.title,column.projects.length]),[['Scheduled',0],['Active',2],['Completed',1],['Not set',1]]);
 assert.equal(new Set(columns.flatMap(column=>column.projects.map(project=>project.id))).size,4);
});
