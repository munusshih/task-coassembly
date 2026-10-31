"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export default function WorkspaceCreateDock({ label, onClick, expanded = false }) {
  const [mounted,setMounted]=useState(false);
  const trigger=useRef(null);
  const previousExpanded=useRef(false);
  useEffect(()=>{if(previousExpanded.current&&!expanded)trigger.current?.focus();previousExpanded.current=expanded;},[expanded]);
  useEffect(()=>setMounted(true),[]);
  if(!mounted || expanded) return null;
  return createPortal(<div data-rationale-anchor="create-new" data-rationale-label={label} className="workspace-create-dock"><button ref={trigger} type="button" onClick={onClick} aria-expanded={expanded}><img className="workspace-create-icon" src={`/illustrations/${({'New task':'compose-task','New member':'compose-member','New project':'compose-project','New proposal':'compose-wish','New resource':'compose-resource'})[label]||'compose-note'}.svg`} alt=""/>{label}<span className="workspace-create-dock-hint" aria-hidden="true">↑</span></button></div>,document.body);
}
