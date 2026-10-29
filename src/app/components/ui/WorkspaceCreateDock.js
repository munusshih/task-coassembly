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
  return createPortal(<div className="workspace-create-dock"><button ref={trigger} type="button" onClick={onClick} aria-expanded={expanded}><span aria-hidden="true">＋</span>{label}<span className="workspace-create-dock-hint" aria-hidden="true">↑</span></button></div>,document.body);
}
