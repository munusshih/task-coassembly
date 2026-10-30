'use client';
import {PROJECT_PRIORITIES,sortPriority,projectPriority} from './projectPriority.mjs';
import {updateDocument} from '../../firestore';
import {Fragment,useState} from 'react';
import {groupProjects,projectStatusColumns,projectBoardStatus} from './workspaceGroups.mjs';
import {projectWorkTone} from './memberRoleMetrics.mjs';
import MetadataPill from './ui/MetadataPill';
import FolderOutline from './ui/FolderOutline';
import ProjectStatusPill, {PROJECT_STATE_DESIGNS} from './ui/ProjectStatusPill';
import ProjectTimeSummary from './ui/ProjectTimeSummary';
import {projectCapacityProgress} from './projectProgress.mjs';
function ProjectCard({project,tasks,members,folder,onOpen,selected,editable,onStatusChange,statuses}) {
 const data=project.data||{},progress=projectCapacityProgress(project,tasks);
 return <li className={`project-preview-card${folder?' project-preview-card--folder':''}${selected?' project-preview-card--selected':''}`} style={{'--folder-paper':`var(--workspace-${projectWorkTone(data.kind)})`}} data-rationale-anchor={`project-${project.id}`} data-rationale-label={data.name||'Project'} draggable={!folder&&editable} onDragStart={event=>{event.dataTransfer.setData('application/x-protocol-project',project.id);event.dataTransfer.effectAllowed='move';event.currentTarget.classList.add('project-preview-card--dragging');}} onDragEnd={event=>event.currentTarget.classList.remove('project-preview-card--dragging')}>
  <button className="project-preview-open" onClick={()=>onOpen(project.id)} aria-label={`Open project: ${data.name||'Unnamed'}`} aria-expanded={selected}>
   {folder&&<FolderOutline fill="var(--folder-paper)"/>}
   <span className="project-preview-title">{data.name||'Unnamed'}</span>
   <span className="project-preview-pills">{folder&&<ProjectStatusPill status={data.status}/>}{data.kind&&<MetadataPill tone={projectWorkTone(data.kind)}>{data.kind}</MetadataPill>}</span>
   <ProjectTimeSummary progress={progress} compact={!folder}/>
  </button>

 </li>;
}
export default function ProjectCollection({projects,tasks,members,mode,selected,onOpen,editable,onStatusChange,statuses,showClosed=false,renderDetails}) {
 const [dropStatus,setDropStatus]=useState(null);
 const card=(project,folder)=> <Fragment key={project.id}><ProjectCard project={project} tasks={tasks} members={members} folder={folder} selected={selected===project.id} onOpen={onOpen} editable={editable} onStatusChange={onStatusChange} statuses={statuses}/>{selected===project.id&&renderDetails&&<li className="project-inline-detail">{renderDetails(project)}</li>}</Fragment>;
 const states=PROJECT_STATE_DESIGNS;
 const dropHandlers=id=>({onDragOver:event=>{if(editable&&event.dataTransfer.types.includes('application/x-protocol-project')){event.preventDefault();event.dataTransfer.dropEffect='move';setDropStatus(id);}},onDragLeave:event=>{if(!event.currentTarget.contains(event.relatedTarget))setDropStatus(null);},onDrop:event=>{event.preventDefault();setDropStatus(null);const project=projects.find(project=>project.id===event.dataTransfer.getData('application/x-protocol-project'));if(editable&&project&&projectBoardStatus(project.data.status)!==id)onStatusChange(project,id);}});
 const heading=group=><header><img className="project-state-icon" src={`/illustrations/${states[group.id].icon}.svg`} alt=""/><h2>{group.title}</h2><span className="task-scope-count">{group.projects.length}</span></header>;
 if(mode==='priority'){
  return <div className="project-status-board" aria-label="Project priority Kanban">{[...PROJECT_PRIORITIES].reverse().map(priority=><section key={priority} className="project-status-column" style={{'--project-status-paper':`var(--palette-${({Urgent:'date',High:'planned',Normal:'blue',Low:'neutral'})[priority]})`}} onDragOver={event=>{if(editable&&event.dataTransfer.types.includes('application/x-protocol-project'))event.preventDefault();}} onDrop={async event=>{event.preventDefault();const id=event.dataTransfer.getData('application/x-protocol-project');if(editable&&projects.some(p=>p.id===id))try{await updateDocument('projects',id,{priority,priorityOrder:Date.now()});}catch(error){window.alert(error.message);}}}><header><img className="project-state-icon" src={`/illustrations/${({Low:'wishes-stone-low',Normal:'walking-person',High:'wishes-motion-high',Urgent:'help-hat'})[priority]}.svg`} alt=""/><h2>{priority}</h2><span className="task-scope-count">{projects.filter(p=>projectPriority(p)===priority).length}</span></header><ul>{sortPriority(projects.filter(p=>projectPriority(p)===priority)).map(project=>card(project,false))}</ul></section>)}</div>;
 }
 if(mode==='status'){
  const groups=projectStatusColumns(projects,statuses),cancelled=groups.find(group=>group.id==='Cancelled');
  return <><div className="project-status-board" aria-label="Projects Kanban board">{groups.filter(group=>group.id!=='Cancelled').map(group=><section key={group.id} aria-label={`${group.title} projects`} style={{'--project-status-paper':`var(--palette-${states[group.id].tone})`}} className={`project-status-column${dropStatus===group.id?' project-status-column--drop':''}`} {...dropHandlers(group.id)}>{heading(group)}<ul>{group.projects.map(project=>card(project,false))}</ul>{!group.projects.length&&<p className="project-column-empty">{group.id==='Completed'&&!showClosed?'Drop here to complete a project':'No projects yet'}</p>}</section>)}</div>{cancelled&&<section aria-label="Cancelled projects" className={`project-cancelled-section${dropStatus==='Cancelled'?' project-status-column--drop':''}`} style={{'--project-status-paper':'var(--palette-date)'}} {...dropHandlers('Cancelled')}>{heading(cancelled)}<ul>{cancelled.projects.map(project=>card(project,false))}</ul>{!cancelled.projects.length&&<p className="project-column-empty">{showClosed?'No cancelled projects.':'Drop here to cancel a project'}</p>}</section>}</>;
 }
 return <div className="project-folder-sections">{groupProjects(projects,'category').map(group=><section key={group.id} className="project-folder-section"><header><h2>{group.title}</h2><span className="task-scope-count">{group.projects.length}</span></header><ul>{[...group.projects].sort((a,b)=>String(a.data.name||a.id).localeCompare(String(b.data.name||b.id))).map(project=>card(project,true))}</ul></section>)}</div>;
}
