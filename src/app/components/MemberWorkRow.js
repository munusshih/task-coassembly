import LetterBadge from './ui/LetterBadge';
import MemberTenure from './ui/MemberTenure';
import MemberAvatar from './ui/MemberAvatar';
import MemberEditButton from './ui/MemberEditButton';
import MemberMilestones from './ui/MemberMilestones';
import MetadataPill from './ui/MetadataPill';
import HeadingCount from './ui/HeadingCount';
import AllocationRing from './ui/AllocationRing';
import SpoonMeter from './ui/SpoonMeter';
import TaskClockIcon from './ui/TaskClockIcon';
import {formatPronouns} from '../lib/pronouns.mjs';
import {WORK_CATEGORIES,workCategory,projectWorkTone} from './memberRoleMetrics.mjs';
export function MemberProjectGroups({projects}) {
 return projects.length?<div className="member-project-categories">{WORK_CATEGORIES.map(category=>{const group=projects.filter(project=>workCategory(project.data?.kind)===category.key);return group.length?<div className="member-project-category" key={category.key}><HeadingCount as="h5" title={category.label} count={group.length}/><div className="member-role-pills">{group.map(project=><MetadataPill key={project.id} tone={category.tone}>{project.data?.name||project.id}</MetadataPill>)}</div></div>:null;})}</div>:<p className="member-role-caption">No current projects.</p>;
}
export default function MemberWorkRow({member,metric,mode,periodLabel,roleTitle,today,formatTime,weekLabel,onProfile,onEdit,highlighted,dimmed,letterIndex}) {
 const name=member.data?.name||member.id,compact=member.data?.active===false;
 const period=mode==='overall'?'Overall':mode==='weekly'?(periodLabel||'This week'):'Last four weeks';
 const projectPills=projects=><div className="member-role-pills">{projects.length?projects.map(project=><MetadataPill key={project.id} tone={projectWorkTone(project.kind)}>{project.name} · {formatTime(project.units)}</MetadataPill>):<span className="member-role-caption">No time allocated</span>}</div>;
 return <article data-rationale-anchor={`member-${member.id}`} data-rationale-label={name} className={`member-role-row${compact?' member-role-row--compact':''}${dimmed?' member-role-row--dimmed':''}${highlighted?' member-role-row--highlighted':''}`}>
  <div className="member-role-identity">{letterIndex!=null&&<LetterBadge index={letterIndex} className="member-identity-letter"/>}<MemberAvatar member={member} onClick={onProfile}/><div className="member-identity-name"><h3>{name}</h3><MemberEditButton name={name} onClick={onEdit}/></div>{formatPronouns(member.data?.pronouns)&&<p className="member-pronouns">{formatPronouns(member.data.pronouns)}</p>}<MetadataPill>{roleTitle}</MetadataPill>{member.data?.email&&<a className="member-email" href={`mailto:${member.data.email}`}>{member.data.email}</a>}<MemberTenure member={member} today={today}/><MemberMilestones member={member} today={today}/></div>
  {compact?<>{metric.total>0&&<p className="member-compact-total">{formatTime(metric.total)} allocated</p>}{metric.historicalProjects?.length>0&&<div className="member-role-projects"><HeadingCount title="Past projects" count={metric.historicalProjects.length}/><MemberProjectGroups projects={metric.historicalProjects}/></div>}</>:<>
  <div className="member-role-projects"><HeadingCount as="h4" title="Current projects" count={metric.currentProjects.length}/><MemberProjectGroups projects={metric.currentProjects}/>{metric.historicalProjects?.length>0&&<><HeadingCount as="h4" title="Past projects" count={metric.historicalProjects.length}/><MemberProjectGroups projects={metric.historicalProjects}/></>}<h4>Work mix</h4><div className="member-work-mix-rows">{metric.categories.map(category=><div className="member-work-mix-row" key={category.key}><span>{category.label}</span><SpoonMeter percent={category.percent} tone={category.tone} label={category.label}/><strong>{Math.round(category.percent)}%</strong></div>)}</div></div>
  <div className="member-role-history"><h4>{period}<MetadataPill tone="planned"><TaskClockIcon/>{formatTime(metric.total)} allocated</MetadataPill></h4>{mode==='overall'?<AllocationRing allocations={metric.projectTotals} formatTime={formatTime}/>:mode==='role'?metric.weeks.map((week,index)=><div key={week.key} className="member-role-week"><div className="member-role-week-heading"><span>{index===0?'This week':index===1?'Last week':weekLabel(week.key)}</span><strong><TaskClockIcon/>{formatTime(week.units)}</strong></div>{projectPills(week.projects)}</div>):projectPills(metric.projectTotals)}</div>
  </>}
 </article>;
}
