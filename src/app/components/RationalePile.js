'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {noteLabel,noteKind} from './rationaleNotes.mjs';
import NoteNumber from './ui/NoteNumber';
export function dropAnchor(x,y){return document.elementsFromPoint(x,y).filter(el=>!el.closest('.rationale-board')).map(el=>el.closest('[data-rationale-anchor]')).find(el=>el&&el.dataset.rationaleAnchor!=='page-content');}
export function pageAnchor(key){return [...document.querySelectorAll('[data-rationale-anchor]')].find(element=>element.dataset.rationaleAnchor===key);}
const clamp=value=>Math.max(0,Math.min(1,value));
export default function RationalePile({pile,overrides,onMove,canDrag,children,disabled,onDragState,onDragTarget,onAnchored,landedNote}) {
 const [index,setIndex]=useState(0),[drag,setDrag]=useState(null),[snapping,setSnapping]=useState(false),[,redraw]=useState(0);
 const [cardHeight,setCardHeight]=useState(290);
 const card=useRef(null),session=useRef(null),snapTimer=useRef(null);
 useEffect(()=>{const landedIndex=pile.notes.findIndex(note=>note.id===landedNote);if(landedIndex>=0)setIndex(landedIndex);},[landedNote,pile.notes.length]);
 const note=pile.notes[Math.min(index,pile.notes.length-1)];
 const draggable=Boolean(canDrag?.(note));
 const kind=noteKind(note),layout={...note.data,...overrides[note.id]};
 const anchored=layout.anchor&&pageAnchor(layout.anchor);
 useEffect(()=>{const update=()=>redraw(value=>value+1);window.addEventListener('scroll',update,true);window.addEventListener('resize',update);const observer=new ResizeObserver(update);observer.observe(document.body);return()=>{window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);observer.disconnect();clearTimeout(snapTimer.current);};},[]);
 useLayoutEffect(()=>{if(!card.current)return;const measure=()=>setCardHeight(card.current?.offsetHeight||290);measure();const observer=new ResizeObserver(measure);observer.observe(card.current);return()=>observer.disconnect();},[]);
 const width=Math.min(280,window.innerWidth-32),height=cardHeight;
 let pos=drag;
 if(!pos&&anchored){const bounds=anchored.getBoundingClientRect();pos={left:Math.max(16,Math.min(window.innerWidth-width-16,bounds.right+12)),top:bounds.top};}
 else if(!pos&&layout.position)pos={left:16+layout.position.x*Math.max(1,window.innerWidth-width-32),top:74+layout.position.y*Math.max(1,window.innerHeight-height-100)};
 function start(event){
  if(event.button!==0||disabled||snapping||!draggable||event.target.closest('input,textarea,select,a,footer,form')||(event.target.closest('button')&&!event.target.closest('.rationale-drag')))return;
  const rect=card.current.getBoundingClientRect();session.current={dx:event.clientX-rect.left,dy:event.clientY-rect.top,x:event.clientX,y:event.clientY,moving:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event){
  const current=session.current;if(!current)return;
  if(!current.moving&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<5)return;
  if(!current.moving){current.moving=true;onDragState?.(note);}
  event.preventDefault();const target=dropAnchor(event.clientX,event.clientY);onDragTarget?.(target?.dataset.rationaleAnchor||null);
  setDrag({left:Math.max(8,Math.min(window.innerWidth-width-8,event.clientX-current.dx)),top:Math.max(64,event.clientY-current.dy)});
 }
 function cancel(){session.current=null;setDrag(null);onDragState?.(null);onDragTarget?.(null);}
 function end(event){
  const current=session.current;if(!current)return;session.current=null;if(!current.moving)return;
  const position={x:clamp((event.clientX-current.dx-16)/Math.max(1,window.innerWidth-width-32)),y:clamp((event.clientY-current.dy-74)/Math.max(1,window.innerHeight-height-100))};
  const target=dropAnchor(event.clientX,event.clientY);
  if(target){
   const bounds=target.getBoundingClientRect();setSnapping(true);
   setDrag({left:Math.max(16,Math.min(window.innerWidth-width-16,bounds.right+12)),top:bounds.top});
   onAnchored?.(target);
   snapTimer.current=setTimeout(()=>{onMove(note,{position,anchor:target.dataset.rationaleAnchor});setSnapping(false);setDrag(null);onDragState?.(null);onDragTarget?.(null);},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:380);
  }else{onMove(note,{position,anchor:null});setDrag(null);onDragState?.(null);onDragTarget?.(null);}
 }
 const next=()=>setIndex((index+1)%pile.notes.length);
 return <article ref={card} data-kind={kind.key} className={`rationale-note${draggable?' rationale-note--draggable':''}${drag&&!snapping?' rationale-note--dragging':''}${snapping?' rationale-note--snapping':''}${pile.notes.length>1?' rationale-note--pile':''}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} style={{'--note-paper':`var(--${kind.paper})`,...(pos?{position:'fixed',left:pos.left,top:pos.top,width,zIndex:drag?970:1}:{} )}}>
  <header className="rationale-note-label">
   {draggable ? (
    <button className="rationale-drag" title="Drag this note onto a page section to anchor it" aria-label={`Drag note ${noteLabel(note)}`}>
     <NoteNumber number={note.number ?? index + 1} kind={kind.key}/>
     <span className="rationale-grip" aria-hidden="true"/>
    </button>
   ) : note.live?<span className="rationale-live-label"><NoteNumber kind="live"/>{note.data.countdown}</span>:<NoteNumber number={note.number ?? index + 1} kind={kind.key}/>}
   {pile.notes.length > 1 && <button className="rationale-pile-count" aria-label={`Note ${Math.min(index + 1, pile.notes.length)} of ${pile.notes.length}; show next note`} title="Read the next note" onClick={next}>{Math.min(index + 1, pile.notes.length)}/{pile.notes.length}</button>}
  </header>
  {children(note)}
  {pile.notes.length>1&&<button className="rationale-fold" aria-label="Open next sticky note in pile" title="Read the next note" onClick={next}/>}
 </article>;
}
