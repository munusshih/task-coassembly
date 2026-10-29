/** Preserve recorded decisions and display older tasks' standalone reasons too. */
export function taskDecisionEntries(data={}) {
 const history=(Array.isArray(data.decisionHistory)?data.decisionHistory:[]).filter(entry=>entry&&['approve','reject'].includes(entry.action)&&typeof entry.reason==='string'&&entry.reason.trim()).map(entry=>({...entry,reason:entry.reason.trim(),createdAt:Number(entry.createdAt)>0?Number(entry.createdAt):null}));
 const legacyOrder=data.reviewed?['reject','approve']:['approve','reject'];
 const legacy=legacyOrder.flatMap(action=>{
  const raw=action==='approve'?data.reviewReason:data.rejectionReason;
  if(typeof raw!=='string'||!raw.trim()||history.some(entry=>entry.action===action&&entry.reason===raw.trim()))return [];
  return [{action,reason:raw.trim(),createdAt:action==='approve'&&Number(data.reviewedAt)>0?Number(data.reviewedAt):null,createdBy:null}];
 });
 return [...legacy,...history];
}
