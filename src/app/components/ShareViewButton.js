"use client";

import { useEffect, useRef, useState } from "react";
import { saveSharedView } from "../../lib/sharedViews";

export default function ShareViewButton({ compact = false }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const input = useRef(null);
  useEffect(() => {
    const reset = () => { setMessage(""); setLink(""); };
    window.addEventListener("popstate", reset);
    window.addEventListener("task:url-change", reset);
    return () => {
      window.removeEventListener("popstate", reset);
      window.removeEventListener("task:url-change", reset);
    };
  }, []);
  useEffect(() => {
    if (link) { input.current?.focus(); input.current?.select(); }
  }, [link]);

  async function copyLink() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setLink("");
    try {
      const path = await saveSharedView(window.location.pathname + window.location.search);
      const href = new URL(path, window.location.origin).href;
      setLink(href);
      try {
        await navigator.clipboard.writeText(href);
        setMessage("Link copied");
      } catch {
        setMessage("Copy this link");
      }
    } catch {
      setMessage("Couldn’t create a short link. You can still copy the address bar URL.");
    } finally { setBusy(false); }
  }
  return (
    <div className={compact ? "share-view share-view--compact" : "share-view"}>
      <button type="button" className={compact ? "btn btn--ghost btn--small" : "nav-signout-btn"} onClick={copyLink} disabled={busy}>
        {busy ? "Creating link…" : "Copy link"}
      </button>
      <span className="share-view-status" role="status">{message}</span>
      {link ? <input ref={input} aria-label="Share link" value={link} readOnly onFocus={(e) => e.target.select()} /> : null}
    </div>
  );
}
