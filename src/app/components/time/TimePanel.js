import HeadingCount from '../ui/HeadingCount';
/** Shared timer heading: the help tour owns explanatory copy. */
export default function TimePanel({anchor,label,title,status,count,active=false,className='',children}) {
 return <article data-rationale-anchor={anchor} data-rationale-label={label} className={`time-panel ${className}`}>
  <header className="time-panel-header"><div className="time-panel-title"><HeadingCount as="h2" title={title} count={count} className="time-panel-heading"/>{status&&<span className="time-panel-status"><img className="time-panel-status-icon" src={`/illustrations/${active?'walking-person':status==='Paused'?'wishes-stone-low':'clock'}.svg`} alt=""/>{status}</span>}</div></header>
  {children}
 </article>;
}
