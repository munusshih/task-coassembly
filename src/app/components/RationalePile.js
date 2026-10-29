'use client';
import {useEffect,useRef,useState} from 'react';
import {noteLabel,noteKind} from './rationaleNotes.mjs';
export function dropAnchor(x,y){return document.elementsFromPoint(x,y).filter(el=>!el.closest('.rationale-board')).map(el=>el.closest('[data-rationale-anchor]')).find(el=>el&&el.dataset.rationaleAnchor!=='page-content');}
export function pageAnchor(key){return [...document.querySelectorAll('[data-rationale-anchor]')].find(element=>element.dataset.rationaleAnchor===key);}
const clamp=value=>Math.max(0,Math.min(1,value));
export default function RationalePile({pile,overrides,onMove,canDrag,children,disabled,onDragState,onDragTarget}) {
 const [index,setIndex]=useState(0),[drag,setDrag]=useState(null),[,redraw]=useState(0);
 const card=useRef(null),session=useRef(null);
 const note=pile.notes[Math.min(index,pile.notes.length-1)];
 const kind=noteKind(note);
 const layout={...note.data,...overrides[note.id]};
 const anchored=layout.anchor&&pageAnchor(layout.anchor);
 useEffect(()=>{const update=()=>redraw(value=>value+1);window.addEventListener('scroll',update,true);window.addEventListener('resize',update);const observer=new ResizeObserver(update);observer.observe(document.body);return()=>{window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);observer.disconnect();};},[]);
 const width=Math.min(280,window.innerWidth-32),height=card.current?.offsetHeight||300;
 let pos=drag;
 if(!pos&&anchored){const bounds=anchored.getBoundingClientRect();pos={left:Math.max(16,Math.min(window.innerWidth-width-16,bounds.right+12)),top:bounds.top};}
 else if(!pos&&layout.position)pos={left:16+layout.position.x*Math.max(1,window.innerWidth-width-32),top:74+layout.position.y*Math.max(1,window.innerHeight-height-100)};
 function start(event){if(event.button!==0||disabled||!canDrag?.(note))return;event.preventDefault();const rect=card.current.getBoundingClientRect();session.current={dx:event.clientX-rect.left,dy:event.clientY-rect.top};event.currentTarget.setPointerCapture(event.pointerId);setDrag({left:rect.left,top:rect.top});onDragState?.(note);}
 function move(event){if(!session.current)return;const target=dropAnchor(event.clientX,event.clientY);onDragTarget?.(target?.dataset.rationaleAnchor||null);setDrag({left:Math.max(8,Math.min(window.innerWidth-width-8,event.clientX-session.current.dx)),top:Math.max(64,event.clientY-session.current.dy)});}
 function end(event){if(!session.current)return;const position={x:clamp((event.clientX-session.current.dx-16)/Math.max(1,window.innerWidth-width-32)),y:clamp((event.clientY-session.current.dy-74)/Math.max(1,window.innerHeight-height-100))};const target=dropAnchor(event.clientX,event.clientY);session.current=null;setDrag(null);onDragState?.(null);onDragTarget?.(null);onMove(note,{position,anchor:target?.dataset.rationaleAnchor||null});}
 return <article ref={card} data-kind={kind.key} className={`rationale-note${drag?' rationale-note--dragging':''}${pile.notes.length>1?' rationale-note--pile':''}`} style={{'--note-paper':`var(--${kind.paper})`,...(pos?{position:'fixed',left:pos.left,top:pos.top,width,zIndex:drag?970:1}:{} )}}>
  <header className="rationale-note-label">{canDrag?.(note)?<button className="rationale-drag" title="Drag this note onto a page section to anchor it" aria-label={`Drag note ${noteLabel(note.id)}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{session.current=null;setDrag(null);onDragState?.(null);onDragTarget?.(null);}}>{noteLabel(note.id)}</button>:<code className="rationale-note-id">{noteLabel(note.id)}</code>}</header>
  {pile.notes.length>1&&<div className="rationale-pile-switch"><button aria-label="Previous note in pile" onClick={()=>setIndex((index+pile.notes.length-1)%pile.notes.length)}>←</button><span>{Math.min(index+1,pile.notes.length)} / {pile.notes.length}</span><button aria-label="Next note in pile" onClick={()=>setIndex((index+1)%pile.notes.length)}>→</button></div>}
  {children(note)}
  {pile.notes.length>1&&<button className="rationale-fold" aria-label="Open next sticky note in pile" title="Read the next note" onClick={()=>setIndex((index+1)%pile.notes.length)}><span aria-hidden="true">↗</span></button>}
 </article>;
}
