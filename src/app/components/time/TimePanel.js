import HeadingCount from '../ui/HeadingCount';
/** Shared timer heading: the help tour owns explanatory copy. */
export default function TimePanel({anchor,label,title,status,count,active=false,className='',children}) {
 return <article data-rationale-anchor={anchor} data-rationale-label={label} className={`time-panel ${className}`}>
  <header className="time-panel-header"><div className="time-panel-title"><HeadingCount as="h2" title={title} count={count} className="time-panel-heading"/>{status&&<span className="time-panel-status"><svg className="time-panel-status-icon" viewBox="0 0 24 24" aria-hidden="true">{status==='Paused'?<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>:active?<circle cx="12" cy="12" r="7"/>:status==='Stopped'?<path d="M6 6h12v12H6z"/>:<path d="m9 5 11 7-11 7z"/>}</svg>{status}</span>}</div></header>
  {children}
 </article>;
}
