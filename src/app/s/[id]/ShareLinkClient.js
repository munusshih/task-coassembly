"use client";

import AccessScreen from "../../components/ui/AccessScreen";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../firebase";
import { resolveSharedView } from "../../../lib/sharedViews";

export default function ShareLinkClient({ id }) {
  const [error, setError] = useState("");
  useEffect(() => {
    if (!auth) { setError("Sharing is not configured."); return; }
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace(`/login?next=${encodeURIComponent(`/s/${id}`)}`);
        return;
      }
      try {
        const destination = await resolveSharedView(id);
        if (!cancelled) window.location.replace(destination);
      } catch (reason) {
        if (!cancelled) setError(reason?.code === "permission-denied"
          ? "You don’t have access to this shared view."
          : reason?.message || "This shared view could not be opened.");
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [id]);
  return <AccessScreen action={error ? <a href="/tasks">Go to Task</a> : null}>
    {error || "Opening shared view…"}
  </AccessScreen>;
}
