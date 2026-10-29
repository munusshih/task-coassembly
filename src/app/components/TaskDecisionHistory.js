import {taskDecisionEntries} from './taskDecisionHistory.mjs';
function Decision({entry,members,latest=false}) {
 const author=members.find(member=>member.id===entry.createdBy);
 const authorName=author?.data?.name||author?.name;
 return <div className={`task-decision-entry${latest?' task-decision-entry--latest':''}`}><div className="task-decision-meta"><strong>{entry.action==='approve'?'Approved':'Changes requested'}</strong>{authorName&&<span>by {authorName}</span>}{entry.createdAt&&<time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</time>}</div><p>{entry.reason}</p></div>;
}
export default function TaskDecisionHistory({data,members=[]}) {
 const entries=taskDecisionEntries(data);
 if(!entries.length)return null;
 const latest=entries[entries.length-1],earlier=entries.slice(0,-1).reverse();
 return <section className="task-decision-history" aria-label="Task review reasons" onClick={event=>event.stopPropagation()}><Decision entry={latest} members={members} latest/>{earlier.length>0&&<details><summary>Earlier reviews ({earlier.length})</summary>{earlier.map((entry,index)=><Decision key={`${entry.createdAt}-${index}`} entry={entry} members={members}/>)}</details>}</section>;
}
