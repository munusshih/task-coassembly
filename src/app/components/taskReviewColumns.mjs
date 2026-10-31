export function taskReviewColumns(tasks) {
 const columns=[{id:'todo',title:'To do',tasks:[]},{id:'awaiting',title:'Awaiting review',tasks:[]},{id:'reviewed',title:'Reviewed',tasks:[]}];
 for(const task of tasks)columns[task.data.reviewed?2:task.data.completed?1:0].tasks.push(task);
 return columns;
}
