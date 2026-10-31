'use client';
/** Shared drag payload, card surface, and keyboard movement for workflow boards. */
export default function KanbanCard({id,type,title,onOpen,draggable=false,onMove,moves=[],showMoveControl=true,metadata,children,footer,className='',href,openLabel,selected,currentStatus}) {
 const Open=href?'a':'button';
 return <li className={`project-task-card ${className}${selected?' project-preview-card--selected':''}`} draggable={draggable} onKeyDown={event=>{if(!draggable||!onMove||!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=moves[moves.indexOf(currentStatus)+(event.key==='ArrowRight'?1:-1)];if(next)onMove(next);}} onDragStart={event=>{event.dataTransfer.setData(type,id);event.dataTransfer.effectAllowed='move';event.currentTarget.classList.add('is-dragging');}} onDragEnd={event=>event.currentTarget.classList.remove('is-dragging')}>
  <Open href={href} type={href?undefined:"button"} aria-label={openLabel} aria-description={draggable&&onMove?'Drag to change status. Keyboard: Alt and Left or Right arrow.':undefined} aria-expanded={selected} className="kanban-card-open" onClick={onOpen}>{metadata&&<div className="kanban-card-meta">{metadata}</div>}<h3>{title}</h3>{children}</Open>
  {footer}

 </li>;
}
