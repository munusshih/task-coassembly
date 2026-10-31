import {workCategory} from './memberRoleMetrics.mjs';
export const PROJECT_PRIORITIES=['Urgent','High','Normal','Low'];
export function projectPriority(project){return PROJECT_PRIORITIES.find(value=>value.toLowerCase()===String(project.data?.priority||'').toLowerCase())||'Normal';}
export function priorityRank(project){return PROJECT_PRIORITIES.indexOf(projectPriority(project));}
export function sortPriority(projects){return [...projects].sort((a,b)=>priorityRank(a)-priorityRank(b)||(Number(a.data.priorityOrder)||0)-(Number(b.data.priorityOrder)||0)||String(a.data.name||'').localeCompare(String(b.data.name||'')));}
export function planningProjectGroups(projects){return [{key:'rd',label:'R&D'},{key:'work',label:'Work'},{key:'admin',label:'Service'},{key:'unclassified',label:'Other'}].map(group=>({...group,projects:sortPriority(projects.filter(project=>workCategory(project.data?.kind)===group.key))})).filter(group=>group.projects.length);}
