'use client';
import {useState} from 'react';
import KanbanBoard from './ui/KanbanBoard';
import KanbanColumn from './ui/KanbanColumn';
import KanbanCard from './ui/KanbanCard';
import MetadataPill from './ui/MetadataPill';
import PersonIdentity from './ui/PersonIdentity';
import styles from './ProposalBoard.module.css';
const designs={Draft:['neutral','compose-wish'],'In review':['blue','review-circle'],'Changes requested':['date','help-hat'],Approved:['worked','approve-person'],'Project created':['project','projects-team'],Archived:['neutral','wishes-stone-low']};
const status=item=>item.data.archived?'Archived':item.data.projectIdCreated?'Project created':item.data.status||'Draft';
export default function ProposalBoard({items,members,canAct,archived,onOpen,onMove}) {
 const [drop,setDrop]=useState(null);
 const stages=archived?['Archived']:Object.keys(designs).filter(stage=>stage!=='Archived');
 return <KanbanBoard label="Proposals by status" className={`proposal-board ${styles.board}`}>{stages.map(stage=>{
  const work=items.filter(item=>status(item)===stage);
  return <KanbanColumn key={stage} title={stage} count={work.length} tone={designs[stage][0]} icon={designs[stage][1]} className={drop===stage?'project-status-column--drop':''} onDragOver={event=>{if(canAct&&!archived&&event.dataTransfer.types.includes('application/x-protocol-proposal')){event.preventDefault();event.dataTransfer.dropEffect='move';setDrop(stage);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDrop(null);}} onDrop={event=>{event.preventDefault();setDrop(null);const id=event.dataTransfer.getData('application/x-protocol-proposal');if(canAct&&id)onMove(id,stage);}}>
   <ul>{work.map(item=><KanbanCard key={item.id} id={item.id} type="application/x-protocol-proposal" title={item.data.text} draggable={canAct&&!archived&&!item.data.projectIdCreated} showMoveControl={false} onOpen={()=>onOpen(item)} onMove={next=>onMove(item.id,next)} moves={stages} currentStatus={stage} metadata={<MetadataPill tone="project">{item.data.proposalType||'Idea'}</MetadataPill>} footer={(item.data.authorId||item.data.authorName)&&<PersonIdentity member={members.find(member=>member.id===item.data.authorId)} name={item.data.authorName}/>}><div className="proposal-board-estimates">{item.data.budget!=null&&item.data.budget!==''&&<span>NT$ {Number(item.data.budget).toLocaleString()}</span>}{item.data.hours!=null&&item.data.hours!==''&&<span>{item.data.hours}h</span>}</div></KanbanCard>)}</ul>
   {!work.length&&<p className="project-column-empty">{archived?'No archived proposals':'Drop a proposal here'}</p>}
  </KanbanColumn>;
 })}</KanbanBoard>;
}
