'use client';
import {useState} from 'react';
import {groupProjects,projectStatusColumns} from './workspaceGroups.mjs';
import {projectWorkTone} from './memberRoleMetrics.mjs';
import MetadataPill from './ui/MetadataPill';
import FolderOutline from './ui/FolderOutline';
import TaskClockIcon from './ui/TaskClockIcon';
function ProjectCard({project,tasks,members,folder,onOpen,selected,editable,onStatusChange,statuses}) {
 const data=project.data||{},projectTasks=tasks.filter(task=>task.data.projectId===project.id&&!task.data.archived);
 const hours=projectTasks.reduce((sum,task)=>sum+(Number(task.data.timeUnits)||0)*.25,0);
 const minutes=Math.round(hours*60),timeLabel=`${Math.floor(minutes/60)}h${minutes%60?` ${minutes%60}m`:''}`;
 const team=[...new Set((data.staffing||[]).map(person=>person.memberId))].map(id=>members.find(member=>member.id===id)?.data?.name).filter(Boolean);
 return <li className={`project-preview-card${folder?' project-preview-card--folder':''}${selected?' project-preview-card--selected':''}`} style={{'--folder-paper':`var(--workspace-${projectWorkTone(data.kind)})`}} data-rationale-anchor={`project-${project.id}`} data-rationale-label={data.name||'Project'} draggable={!folder&&editable} onDragStart={event=>{event.dataTransfer.setData('application/x-protocol-project',project.id);event.dataTransfer.effectAllowed='move';event.currentTarget.classList.add('project-preview-card--dragging');}} onDragEnd={event=>event.currentTarget.classList.remove('project-preview-card--dragging')}>
  <button className="project-preview-open" onClick={()=>onOpen(project.id)} aria-label={`Open project: ${data.name||'Unnamed'}`} aria-expanded={selected}>
   {folder&&<FolderOutline fill="var(--folder-paper)"/>}
   <span className="project-preview-title">{data.name||'Unnamed'}</span>
   <span className="project-preview-pills">{folder&&data.status&&<MetadataPill>{data.status}</MetadataPill>}{data.kind&&<MetadataPill tone={projectWorkTone(data.kind)}>{data.kind}</MetadataPill>}</span>
   <span className="project-preview-hours"><TaskClockIcon/>{timeLabel} allocated<span>{projectTasks.filter(task=>task.data.completed).length}/{projectTasks.length} tasks</span></span>
   {team.length>0&&<span className="project-preview-team">{team.join(' · ')}</span>}
  </button>
  {!folder&&editable&&<label className="project-card-status"><span>Move to</span><select aria-label={`Move ${data.name||'project'} to status`} value={data.status||''} onChange={event=>onStatusChange(project,event.target.value)}><option value="" disabled>Status…</option>{statuses.map(status=><option key={status}>{status}</option>)}</select></label>}
 </li>;
}
export default function ProjectCollection({projects,tasks,members,mode,selected,onOpen,editable,onStatusChange,statuses}) {
 const [dropStatus,setDropStatus]=useState(null);
 const card=(project,folder)=> <ProjectCard key={project.id} project={project} tasks={tasks} members={members} folder={folder} selected={selected===project.id} onOpen={onOpen} editable={editable} onStatusChange={onStatusChange} statuses={statuses}/>;
 if(mode==='status')return <div className="project-status-board" aria-label="Projects Kanban board">{projectStatusColumns(projects,statuses).map(group=><section key={group.id} aria-label={`${group.title} projects`} className={`project-status-column${dropStatus===group.id?' project-status-column--drop':''}`} onDragOver={event=>{if(editable&&event.dataTransfer.types.includes('application/x-protocol-project')){event.preventDefault();event.dataTransfer.dropEffect='move';setDropStatus(group.id);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDropStatus(null);}} onDrop={event=>{event.preventDefault();setDropStatus(null);const project=projects.find(project=>project.id===event.dataTransfer.getData('application/x-protocol-project'));if(editable&&project&&project.data.status!==group.id)onStatusChange(project,group.id);}}><header><h2>{group.title}</h2><span className="task-scope-count">{group.projects.length}</span></header><ul>{group.projects.map(project=>card(project,false))}</ul>{!group.projects.length&&<p className="project-column-empty">No projects yet</p>}</section>)}</div>;
 return <div className="project-folder-sections">{groupProjects(projects,'category').map(group=><section key={group.id} className="project-folder-section"><header><h2>{group.title}</h2><span className="task-scope-count">{group.projects.length}</span></header><ul>{[...group.projects].sort((a,b)=>String(a.data.name||a.id).localeCompare(String(b.data.name||b.id))).map(project=>card(project,true))}</ul></section>)}</div>;
}
