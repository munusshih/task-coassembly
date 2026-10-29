/** Shared heading and spacing for the three parts of task time tracking. */
export default function TimePanel({anchor,label,title,description,status,active=false,className='',children}) {
 return <article data-rationale-anchor={anchor} data-rationale-label={label} className={`time-panel ${className}`}>
  <header className="time-panel-header"><div className="time-panel-title"><h2>{title}</h2>{status&&<span className="time-panel-status">{active&&<span className="time-status-dot is-tracking" aria-hidden="true"/>}{status}</span>}</div><p>{description}</p></header>
  {children}
 </article>;
}
