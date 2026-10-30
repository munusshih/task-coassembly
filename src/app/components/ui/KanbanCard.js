'use client';
/** Shared drag payload, card surface, and keyboard movement for workflow boards. */
export default function KanbanCard({id,type,title,onOpen,draggable=false,onMove,moves=[],metadata,children,footer,className='',href,openLabel,selected}) {
 const Open=href?'a':'button';
 return <li className={`project-task-card ${className}${selected?' project-preview-card--selected':''}`} draggable={draggable} onDragStart={event=>{event.dataTransfer.setData(type,id);event.dataTransfer.effectAllowed='move';event.currentTarget.classList.add('is-dragging');}} onDragEnd={event=>event.currentTarget.classList.remove('is-dragging')}>
  <Open href={href} type={href?undefined:"button"} aria-label={openLabel} aria-expanded={selected} className="kanban-card-open" onClick={onOpen}>{metadata&&<div className="kanban-card-meta">{metadata}</div>}<h3>{title}</h3>{children}</Open>
  {footer}
  {onMove&&draggable&&<label className="kanban-card-move">Move to<select aria-label={`Move ${title}`} value="" onChange={event=>{if(event.target.value)onMove(event.target.value);}}><option value="">Choose status…</option>{moves.map(move=><option key={move} value={move}>{move}</option>)}</select></label>}
 </li>;
}
