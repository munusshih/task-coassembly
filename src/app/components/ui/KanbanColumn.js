import HeadingCount from './HeadingCount';
export default function KanbanColumn({title,count,icon,tone='neutral',className='',children,...props}) {
 return <section {...props} aria-label={props['aria-label']||title} className={`project-status-column ${className}`} style={{'--project-status-paper':`var(--palette-${tone})`,...props.style}}><header>{icon&&<img className="project-state-icon" src={`/illustrations/${icon}.svg`} alt=""/>}<HeadingCount as="h2" title={title} count={count}/></header>{children}</section>;
}
