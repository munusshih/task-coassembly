"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, firebaseReady, googleProvider } from "../../firebase";
import { findMemberForAuth, isMemberEnabled } from "../../authAccess";

function safeNext(nextParam) {
  if (!nextParam || typeof nextParam !== "string") return "/";
  if (!nextParam.startsWith("/")) return "/";
  if (nextParam.startsWith("//")) return "/";
  return nextParam;
}

export default function LoginClient({
  next = "/",
  showError = false,
  showExpired = false,
  showDenied = false,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const safeDestination = useMemo(() => safeNext(next), [next]);

  useEffect(() => {
    if (!firebaseReady || !auth) return undefined;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const member = await findMemberForAuth({ uid: user.uid, email: user.email });
        if (!member || !isMemberEnabled(member.data)) {
          await signOut(auth);
          setMessage("This account is not active in Members yet.");
          return;
        }
        router.replace(safeDestination);
      } catch {
        // Ignore startup auth check issues on login page.
      }
    });

    return () => unsub();
  }, [router, safeDestination]);

  async function handleGoogleSignIn() {
    if (!firebaseReady || !auth || !googleProvider) {
      setMessage("Firebase auth is not configured.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const member = await findMemberForAuth({ uid: user.uid, email: user.email });
      if (!member || !isMemberEnabled(member.data)) {
        await signOut(auth);
        setMessage("No active member record found for this Google account.");
        return;
      }

      router.replace(safeDestination);
    } catch (error) {
      setMessage(error?.message || "Could not sign in with Google.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-form">
      {(showError || showDenied) && (
        <p className="login-error">
          This account cannot access the dashboard.
        </p>
      )}
      {showExpired && (
        <p className="login-error login-error--expired">
          Session has expired. Please sign in again.
        </p>
      )}
      {message ? <p className="login-error">{message}</p> : null}

      <button
        type="button"
        className="login-submit"
        onClick={handleGoogleSignIn}
        disabled={busy}
      >
        {busy ? "Signing in..." : "Continue with Google"}
      </button>
    </div>
  );
}
