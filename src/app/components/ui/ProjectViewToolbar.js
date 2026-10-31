'use client';
import SelectField from './SelectField';
/** One project selector for every collection view, with view-specific actions. */
export default function ProjectViewToolbar({projects,value,onChange,children}) {
 return <div className="project-view-toolbar"><label>Project<SelectField aria-label="Filter projects" value={value} onChange={event=>onChange(event.target.value)}><option value="">All projects</option>{projects.map(project=><option key={project.id} value={project.id}>{project.data.name}</option>)}</SelectField></label>{children}</div>;
}
