import { WORK_CATEGORIES, workCategory } from './memberRoleMetrics.mjs';
export function groupProjects(projects, mode='category') {
  if (mode === 'status') {
    const groups=new Map();
    projects.forEach(project=>{const label=String(project.data?.status||'Not set');if(!groups.has(label))groups.set(label,[]);groups.get(label).push(project);});
    return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([title,projects])=>({id:title,title,projects}));
  }
  return WORK_CATEGORIES.map(category=>({...category,title:category.label,id:category.key,projects:projects.filter(project=>workCategory(project.data?.kind)===category.key)})).filter(group=>group.projects.length);
}
export function groupWishes(items, projects, mode='project') {
  const groups=new Map();
  items.forEach(item=>{
    let id,title,project=null;
    if(mode==='date') {
      const date=new Date(Number(item.data?.createdAt));
      const valid=Number.isFinite(date.getTime()) && Number(item.data?.createdAt)>0;
      id=valid?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`:'undated';
      title=valid?date.toLocaleDateString('en-US',{month:'long',year:'numeric'}):'Date not set';
    } else {
      id=item.data?.projectId||'unassigned';project=projects.find(project=>project.id===id)||null;title=project?.data?.name||(id==='unassigned'?'Unassigned':'Unknown project');
    }
    if(!groups.has(id))groups.set(id,{id,title,project,items:[],archivedItems:[]});
    groups.get(id)[item.data?.archived?'archivedItems':'items'].push(item);
  });
  return [...groups.values()].sort((a,b)=>mode==='date'?b.id.localeCompare(a.id):a.title.localeCompare(b.title));
}

// Keep every workflow stage visible as a drop target, including empty stages.
export function projectStatusColumns(projects,statuses) {
 const columns=statuses.map(status=>({id:status,title:status,projects:[]}));
 const byStatus=new Map(columns.map(column=>[column.id,column]));
 for(const project of projects){const status=String(project.data?.status||'');if(!byStatus.has(status)){const column={id:status,title:status||'Not set',projects:[]};columns.push(column);byStatus.set(status,column);}byStatus.get(status).projects.push(project);}
 for(const column of columns)column.projects.sort((a,b)=>String(a.data?.name||a.id).localeCompare(String(b.data?.name||b.id)));
 return columns;
}
