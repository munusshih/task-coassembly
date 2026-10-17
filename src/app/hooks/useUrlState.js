"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { belongsToView, buildViewUrl, readViewUrl } from "../lib/viewUrl.mjs";
export { isDateKey, isDocumentId } from "../lib/viewUrl.mjs";

const URL_CHANGE = "task:url-change";
function subscribe(onChange) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_CHANGE, onChange);
  };
}
function snapshot() {
  return window.location.pathname + window.location.search;
}
export function updateUrlState(values, { replace = false } = {}) {
  const url = buildViewUrl(new URL(window.location.href), values);
  if (url.href === window.location.href) return;
  window.history[replace ? "replaceState" : "pushState"](window.history.state, "", url);
  window.dispatchEvent(new Event(URL_CHANGE));
}

// Only the currently mounted view may normalize its state. Date defaults are pinned
// explicitly so a link opened next week still points to the same week.
export default function useUrlState(key, initialValue, options = {}) {
  const [fallback] = useState(initialValue);
  const location = useSyncExternalStore(subscribe, snapshot, () => null);
  const { allowed, validate, replace = false } = options;
  const read = useCallback((state) => {
    const value = state[key];
    if (value == null || (allowed && !allowed.includes(value)) ||
        (validate && !validate(value))) return fallback;
    return value;
  }, [key, fallback, allowed, validate]);
  const value = location === null ? fallback : read(readViewUrl(new URL(location, "http://task.local")));

  useEffect(() => {
    if (location === null) return;
    const current = readViewUrl(new URL(window.location.href));
    if (!belongsToView(key, current.tab)) return;
    updateUrlState({ [key]: value }, { replace: true });
  }, [key, location, value]);

  const setValue = useCallback((next) => {
    const state = readViewUrl(new URL(window.location.href));
    if (!belongsToView(key, state.tab)) return;
    updateUrlState({ [key]: typeof next === "function" ? next(read(state)) : next }, { replace });
  }, [key, read, replace]);
  return [value, setValue];
}
