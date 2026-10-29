"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { logTaskTime } from "../../../lib/taskTime";
import {
  emptyJournal, recoverJournal, advanceJournal, closeAuto, pauseFocus,
  startFocus, resumeFocus, finishFocus, IDLE_MS, eligibleTimeFragments, recordLoggedFragments,
} from "./trackingModel.mjs";

const TimeContext = createContext(null);
const FocusTaskContext = createContext(null);
export const useFocusTask = () => useContext(FocusTaskContext);
export const useTaskTime = () => useContext(TimeContext);

export default function TimeTrackingProvider({ memberId, active, children }) {
  const key = `task-time-v1:${memberId}`;
  const journal = useRef(emptyJournal());
  const activeRef = useRef(active);
  activeRef.current = active;
  const owner = useRef(false);
  const lastInput = useRef(Date.now());
  const busyRef = useRef(false);
  const [state, setState] = useState({ journal: journal.current, now: Date.now(), owner: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const persistRef = useRef(() => {});
  const publish = () => setState({ journal: journal.current, now: Date.now(), owner: owner.current });
  const save = (next) => {
    journal.current = { ...next, lastSeen: Date.now() };
    persistRef.current();
    publish();
  };

  useEffect(() => {
    let disposed = false, releaseLock = null, acquiring = false, lastSave = 0, suspended = false;
    const token = crypto.randomUUID(), leaseKey = `${key}:lease`;
    const read = () => {
      try { return JSON.parse(localStorage.getItem(key) || "null"); }
      catch { return null; }
    };
    const persist = () => {
      if (!owner.current) return;
      try { localStorage.setItem(key, JSON.stringify(journal.current)); lastSave = Date.now(); }
      catch { setError("Time cannot be saved on this device. Keep this page open and log your time before leaving."); }
    };
    persistRef.current = persist;
    const adopt = () => {
      if (disposed || suspended) return;
      owner.current = true;
      journal.current = recoverJournal(read());
      journal.current = advanceJournal(journal.current, Date.now(), { active: activeRef.current, lastInput: lastInput.current });
      persist(); publish();
    };
    const release = () => {
      if (!owner.current) return;
      const now = Date.now();
      journal.current = pauseFocus(closeAuto(journal.current, now), now, true);
      journal.current.lastSeen = now;
      persist(); owner.current = false;
      if (releaseLock) { releaseLock(); releaseLock = null; }
      else {
        try { if (JSON.parse(localStorage.getItem(leaseKey) || "null")?.owner === token) localStorage.removeItem(leaseKey); } catch {}
      }
      if (!disposed) publish();
    };
    const acquire = () => {
      if (owner.current || acquiring || disposed || suspended) return;
      if (navigator.locks) {
        acquiring = true;
        navigator.locks.request(key, { ifAvailable: true }, async (lock) => {
          if (!lock || disposed || suspended) return;
          await new Promise((resolve) => { releaseLock = resolve; adopt(); });
        }).catch(() => setError("The tracker could not start. Reload this page to retry.")).finally(() => { acquiring = false; });
      } else {
        // Older browsers coordinate through an expiring lease.
        try {
          const lease = JSON.parse(localStorage.getItem(leaseKey) || "null");
          if (!lease || lease.expires < Date.now() || lease.owner === token) {
            localStorage.setItem(leaseKey, JSON.stringify({ owner: token, expires: Date.now() + 15000 }));
            if (JSON.parse(localStorage.getItem(leaseKey))?.owner === token) adopt();
          }
        } catch { setError("Enable browser storage to use the time tracker."); }
      }
    };
    journal.current = recoverJournal(read()); publish();
    const tick = () => {
      if (suspended) return;
      const now = Date.now();
      const wantsTracker = activeRef.current || journal.current.focus?.status === "running";
      if (wantsTracker) acquire();
      if (owner.current) {
        journal.current = { ...advanceJournal(journal.current, now, { active: activeRef.current, lastInput: lastInput.current }), lastSeen: now };
        if (!wantsTracker) release();
        else if (now - lastSave >= 5000) {
          if (!navigator.locks) {
            try {
              const lease = JSON.parse(localStorage.getItem(leaseKey) || "null");
              if (lease?.owner !== token && lease?.expires > now) { release(); return; }
              localStorage.setItem(leaseKey, JSON.stringify({ owner: token, expires: now + 15000 }));
            } catch {}
          }
          persist();
        }
      }
      publish();
    };
    const input = () => {
      const now = Date.now();
      // Capture the idle boundary before fresh input resets it, including after
      // browser throttling delayed a heartbeat in the background.
      if (owner.current && now - lastInput.current >= IDLE_MS) {
        journal.current = advanceJournal(journal.current, now, { active: activeRef.current, lastInput: lastInput.current });
        journal.current = advanceJournal(journal.current, now, { active: activeRef.current, lastInput: now });
        persist(); publish();
      }
      lastInput.current = now;
    };
    const storage = (event) => {
      if (event.key === key && !owner.current) {
        const raw = read();
        if (raw?.version === 1 && Array.isArray(raw.fragments)) { journal.current = raw; publish(); }
      }
    };
    const hide = () => { suspended = true; release(); };
    const show = () => { suspended = false; tick(); };
    for (const event of ["pointerdown", "keydown", "wheel", "pointermove"]) window.addEventListener(event, input, { passive: true });
    window.addEventListener("storage", storage);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      disposed = true; clearInterval(interval); release();
      for (const event of ["pointerdown", "keydown", "wheel", "pointermove"]) window.removeEventListener(event, input);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      persistRef.current = () => {};
    };
  }, [key]);

  // Immediately checkpoint when leaving TASK; background browser tabs keep counting.
  useEffect(() => {
    if (owner.current) save(advanceJournal(journal.current, Date.now(), { active, lastInput: lastInput.current }));
  }, [active]);

  function change(transform) {
    if (!owner.current) { setError("Time tracking is active in another TASK tab. Use that tab to manage it."); return; }
    try {
      setError("");
      const now = Date.now();
      save(advanceJournal(transform(journal.current, now), now, { active: activeRef.current, lastInput: lastInput.current }));
    }
    catch (failure) { setError(failure.message); }
  }
  async function log(ids, taskId) {
    if (!owner.current || busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const fragments = eligibleTimeFragments(journal.current.fragments, true).filter((f) => ids.includes(f.id));
      if (!fragments.length) throw new Error("Choose a time block of at least 10 minutes.");
      await logTaskTime(memberId, taskId, fragments);
      const next = recordLoggedFragments(journal.current,fragments,taskId);
      save(next); return true;
    } catch (failure) { setError(failure.message || "Time could not be logged. Your fragments are still saved for retry."); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (state.journal.completion?.reason !== "time-up") return;
    const original = document.title;
    document.title = "Focus complete · TASK";
    return () => { document.title = original; };
  }, [state.journal.completion?.id]);

  const attempted = useRef(new Set());
  const completion = state.journal.completion;
  useEffect(() => {
    if (!state.owner || !completion?.autoLog || completion.status !== "pending" || attempted.current.has(completion.id)) return;
    attempted.current.add(completion.id);
    const ids = eligibleTimeFragments(journal.current.fragments).filter(f => f.sessionId === completion.id).map(f=>f.id);
    if (!ids.length) save({...journal.current, completion:{...completion,status:"too-short"}});
    if (ids.length) log(ids, completion.taskId);
  }, [completion?.id, state.owner]);

  const value = { ...state, busy, error,
    start: (options) => change((j, now) => startFocus(j, now, options)),
    pause: () => change(pauseFocus), resume: () => change(resumeFocus), finish: () => change(finishFocus),
    checkpoint: () => { change(closeAuto); return eligibleTimeFragments(journal.current.fragments); },
    dismiss: () => change((j) => ({ ...j, completion: null })),
    snooze: () => change((j, now) => ({ ...j, nextReminderAt: now + 15 * 60000 })),
    discard: (ids) => change((j) => ({ ...j, fragments: j.fragments.map((f) => ids.includes(f.id) && f.status === "pending" ? { ...f, status: "discarded" } : f) })),
    log,
  };
  return <TimeContext.Provider value={value}><FocusTaskContext.Provider value={state.journal.focus?.status === "running" ? state.journal.focus.taskId : null}>{children}
    {!active && completion ? <div className="time-global-notice" role="alert">{completion.reason === "time-up" ? "Focus time is up." : "Focus session finished."} {completion.status === "logged" ? "Time logged." : "Open TASK to review your time."}</div> : null}
  </FocusTaskContext.Provider></TimeContext.Provider>;
}
