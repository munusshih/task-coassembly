import PersonIdentity from './ui/PersonIdentity';
import {taskDecisionEntries} from './taskDecisionHistory.mjs';
import styles from './TaskDecisionHistory.module.css';
const dateLabel=entry=>entry.createdAt?new Date(entry.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
function Decision({entry,members,latest=false}) {
 const author=members.find(member=>member.id===entry.createdBy),name=author?.data?.name||author?.name;
 return <div className={`task-decision-entry ${styles.entry}`}><div className={styles.meta}>{!latest&&<strong>{entry.action==='approve'?'Approved':'Changes requested'}</strong>}{name&&<PersonIdentity member={author} name={name}/>}<time dateTime={entry.createdAt?new Date(entry.createdAt).toISOString():undefined}>{dateLabel(entry)}</time></div><blockquote>{entry.reason}</blockquote></div>;
}
export default function TaskDecisionHistory({data,members=[]}) {
 const entries=taskDecisionEntries(data);
 if(!entries.length)return null;
 const latest=entries.at(-1),earlier=entries.slice(0,-1).reverse();
 return <section className={`task-decision-history ${styles.history}`} aria-label="Task review reasons" onClick={event=>event.stopPropagation()}><details className={styles.latest}><summary><img src={`/illustrations/${latest.action==='approve'?'approve-person':'reject-cross'}.svg`} alt=""/><span>{latest.action==='approve'?'Approved':'Changes requested'}</span><span className={styles.count}>{entries.length} {entries.length===1?'review':'reviews'}</span></summary><Decision entry={latest} members={members} latest/>{earlier.length>0&&<details className={styles.earlier}><summary>Earlier reviews ({earlier.length})</summary>{earlier.map((entry,index)=><Decision key={`${entry.createdAt}-${index}`} entry={entry} members={members}/>)}</details>}</details></section>;
}
