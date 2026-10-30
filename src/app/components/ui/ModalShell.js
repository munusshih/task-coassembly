"use client";

import {createPortal} from "react-dom";
import {useEffect,useState,useRef} from "react";
import CloseButton from "./CloseButton";

export default function ModalShell({
  title,
  headerActions,
  onClose,
  children,
  footer,
  size = "md",
  fullscreen = false,
  className = "",
  bodyClassName = "",
  closeTitle = "Close",
  closeOnOverlayClick = false,
  hasUnsavedChanges = false,
  unsavedWarning = "You have unsaved changes. Close anyway?",
  onDiscardChanges,
}) {
  const modalRef=useRef(null);
  const closeRef=useRef(null);
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  useEffect(()=>{
    if(!fullscreen||!mounted)return;
    const previous=document.activeElement, overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    modalRef.current?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current?.();}
      if(event.key==='Tab'){
        const nodes=[...modalRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[contenteditable=true],[tabindex="0"]')].filter(node=>node.getClientRects().length);
        const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
  },[fullscreen,mounted]);
  const modalClasses = [
    "edit-modal",
    fullscreen ? "edit-modal--fullscreen" : "",
    size === "sm" ? "edit-modal--sm" : "",
    size === "lg" ? "edit-modal--lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClasses = ["edit-modal-body", bodyClassName]
    .filter(Boolean)
    .join(" ");

  function requestClose() {
    if (!onClose) return;
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(unsavedWarning);
      if (!confirmed) return;
      if (typeof onDiscardChanges === "function") onDiscardChanges();
    }
    onClose();
  }

  closeRef.current=requestClose;

  function handleOverlayClick() {
    if (!closeOnOverlayClick) return;
    requestClose();
  }

  const content = (
    <div className={`edit-modal-overlay${fullscreen?' edit-modal-overlay--fullscreen':''}`} onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        className={modalClasses}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="edit-modal-header">
            <span className="edit-modal-title">{title}</span>
            {headerActions}
            {onClose ? (
              <CloseButton className="edit-modal-close" onClick={requestClose} label={closeTitle} />
            ) : null}
          </div>
        )}
        <div className={bodyClasses}>{children}</div>
        {footer ? <div className="edit-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
  return fullscreen ? (mounted ? createPortal(content,document.body) : null) : content;
}
