/** Shared horizontal board shell for projects, tasks, and proposals. */
export default function KanbanBoard({label,className='',children}) {
 return <div className={`project-status-board ${className}`} aria-label={label}>{children}</div>;
}
