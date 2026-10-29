import AllocationTimeline from './ui/AllocationTimeline';
import MemberAvatar from './ui/MemberAvatar';
import MemberEditButton from './ui/MemberEditButton';
import MemberMilestones from './ui/MemberMilestones';
import MetadataPill from './ui/MetadataPill';
import SpoonMeter from './ui/SpoonMeter';
import TaskClockIcon from './ui/TaskClockIcon';
import { formatPronouns } from '../lib/pronouns.mjs';
import { tenureText } from './memberMilestones.mjs';
import { WORK_CATEGORIES, workCategory, projectWorkTone } from './memberRoleMetrics.mjs';

export function MemberProjectGroups({ projects }) {
  return projects.length ? <div className="member-project-categories">{WORK_CATEGORIES.map(category => {
    const group=projects.filter(project => workCategory(project.data?.kind) === category.key);
    return group.length ? <div className="member-project-category" key={category.key}><h5>{category.label}</h5><div className="member-role-pills">{group.map(project => <MetadataPill key={project.id} tone={category.tone}>{project.data?.name || project.id}</MetadataPill>)}</div></div> : null;
  })}</div> : <p className="member-role-caption">No current projects.</p>;
}
export default function MemberWorkRow({member, metric, mode, periodLabel, roleTitle, today, formatTime, weekLabel, onProfile, onEdit, highlighted, dimmed}) {
  const name=member.data?.name || member.id;
  const profileOnly=member.data?.active === false && !metric.assigned && !metric.currentProjects.length;
  const period=mode==='overall'?'Overall':mode==='weekly'?(periodLabel || 'This week'):'Last four weeks';
  const projectPills=projects => <div className="member-role-pills">{projects.length ? projects.map(project => <MetadataPill key={project.id} tone={projectWorkTone(project.kind)}>{project.name} · {formatTime(project.units)}</MetadataPill>) : <span className="member-role-caption">No time allocated</span>}</div>;
  return <article className={`member-role-row${profileOnly?' member-role-row--profile-only':''}${dimmed?' member-role-row--dimmed':''}${highlighted?' member-role-row--highlighted':''}`}>
    <div className="member-role-identity"><MemberAvatar member={member} onClick={onProfile}/><h3>{name}{formatPronouns(member.data?.pronouns)&&<span className="member-pronouns">{formatPronouns(member.data.pronouns)}</span>}<MemberEditButton name={name} onClick={onEdit}/></h3>{mode !== 'role' && <MetadataPill>{roleTitle}</MetadataPill>}{member.data?.active === false && <MetadataPill>Inactive</MetadataPill>}<p className="member-tenure">{tenureText(member.data||{},today)}</p><MemberMilestones member={member} today={today}/></div>
    {!profileOnly && <><div className="member-role-projects"><h4>Current projects <span className="task-scope-count">{metric.currentProjects.length}</span></h4><MemberProjectGroups projects={metric.currentProjects}/><h4>Work mix</h4><div className="member-work-mix-rows">{metric.categories.map(category=><div className="member-work-mix-row" key={category.key}><span>{category.label}</span><SpoonMeter percent={category.percent} tone={category.tone} label={category.label}/><strong>{Math.round(category.percent)}%</strong></div>)}</div><AllocationTimeline weeks={metric.weeks} formatTime={formatTime} weekLabel={weekLabel}/></div>
    <div className="member-role-history"><h4>{period} <MetadataPill tone="planned"><TaskClockIcon/>{formatTime(metric.total)} allocated</MetadataPill></h4>
      {mode==='role'?metric.weeks.map((week,index)=><div key={week.key} className="member-role-week"><div className="member-role-week-heading"><span>{index===0?'This week':index===1?'Last week':weekLabel(week.key)}</span><strong><TaskClockIcon/>{formatTime(week.units)}</strong></div>{projectPills(week.projects)}</div>):projectPills(metric.projectTotals)}
    </div></>}
  </article>;
}
