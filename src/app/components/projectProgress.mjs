import { workedTaskSeconds } from './time/trackingModel.mjs';
export function projectTimeProgress(projectId, tasks) {
  const work = tasks.filter(task => task.data?.projectId === projectId && !task.data.archived);
  const allocatedSeconds = work.reduce((sum, task) => sum + Math.max(0, Number(task.data.timeUnits) || 0) * 900, 0);
  const loggedSeconds = work.reduce((sum, task) => sum + workedTaskSeconds(task.data), 0);
  const percent = allocatedSeconds ? Math.round(loggedSeconds / allocatedSeconds * 100) : 0;
  return { allocatedSeconds, loggedSeconds, percent, fill: Math.min(100, Math.max(0, percent)) };
}

export function projectCapacityProgress(project, tasks) {
 const time=projectTimeProgress(project.id,tasks),data=project.data||{};
 const planned=(data.stagePlans||[]).reduce((sum,stage)=>sum+Math.max(0,Number(stage.perspectiveHours)||0),0);
 const hours=Number(data.maxHours)>0?Number(data.maxHours):planned;
 const capacitySeconds=hours>0?hours*3600:null;
 const scale=capacitySeconds||Math.max(time.allocatedSeconds,time.loggedSeconds,1);
 return {...time,capacitySeconds,capacityFill:capacitySeconds?100:0,allocatedFill:Math.min(100,time.allocatedSeconds/scale*100),loggedFill:Math.min(100,time.loggedSeconds/scale*100),capacityPercent:capacitySeconds?Math.round(time.loggedSeconds/capacitySeconds*100):null};
}
