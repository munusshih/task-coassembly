"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CloseButton from "./CloseButton";
import { WORKSPACE_THEME } from "./palette";

// A non-modal workspace composer: the page remains available while drafting.
export default function BottomComposer({ title, onClose, children, className = "" }) {
  const titleId = useId();
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const trigger = document.activeElement;
    setMounted(true);
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => {
    if (!mounted) return;
    panel.current?.querySelector('input, textarea, select')?.focus();
    const escape = event => { if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(<section ref={panel} role="region" aria-labelledby={titleId} className={`bottom-composer ${className}`} style={WORKSPACE_THEME}>
    <header className="bottom-composer-header"><h2 id={titleId}>{title}</h2><CloseButton label={`Close ${title.toLowerCase()}`} onClick={onClose} /></header>
    <div className="bottom-composer-body">{children}</div>
  </section>, document.body);
}
