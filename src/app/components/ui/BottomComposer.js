"use client";

import { createContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CloseButton from "./CloseButton";
import WorkspaceIllustration from "./WorkspaceIllustration";
import { WORKSPACE_THEME } from "./palette";

export const ComposerDismissContext=createContext(null);

// A non-modal workspace composer: the page remains available while drafting.
export default function BottomComposer({ title, onClose, children, className = "", illustration = "task-maker" }) {
  const titleId = useId();
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const [closing,setClosing]=useState(false);
  const timer=useRef(null),closingRef=useRef(false);
  function dismiss(){if(closingRef.current)return;closingRef.current=true;setClosing(true);timer.current=setTimeout(()=>closeRef.current(),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:220);}
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const trigger = document.activeElement;
    setMounted(true);
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => {
    if (!mounted) return;
    panel.current?.querySelector('input, textarea, select')?.focus();
    const escape = event => { if (event.key === "Escape") { event.stopPropagation(); dismiss(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(<section ref={panel} role="region" aria-labelledby={titleId} className={`bottom-composer${closing?' bottom-composer--closing':''} ${className}`} style={WORKSPACE_THEME}>
    <header className="bottom-composer-header"><div className="bottom-composer-heading"><h2 id={titleId}>{title}</h2><WorkspaceIllustration name={illustration} className="composer-illustration" /></div><CloseButton label={`Close ${title.toLowerCase()}`} onClick={dismiss} /></header>
    <ComposerDismissContext.Provider value={dismiss}><div className="bottom-composer-body">{children}</div></ComposerDismissContext.Provider>
  </section>, document.body);
}
