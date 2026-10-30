export function continuousTimeSessions(fragments) {
 const sessions=[];
 for(const fragment of [...fragments].sort((a,b)=>a.start-b.start)){
  const previous=sessions[sessions.length-1];
  const compatible=previous&&previous.source===fragment.source&&previous.taskId===fragment.taskId&&previous.sessionId===fragment.sessionId&&fragment.start>=previous.end&&fragment.start-previous.end<=1000&&previous.fragments.length<100;
  if(compatible){previous.end=fragment.end;previous.seconds+=fragment.seconds;previous.fragments.push(fragment);}
  else sessions.push({id:fragment.id,start:fragment.start,end:fragment.end,seconds:fragment.seconds,source:fragment.source,taskId:fragment.taskId,sessionId:fragment.sessionId,fragments:[fragment]});
 }
 return sessions;
}
