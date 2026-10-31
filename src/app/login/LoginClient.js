"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, firebaseReady, googleProvider } from "../../firebase";
import { findMemberForAuth, isMemberEnabled } from "../../authAccess";

function safeNext(nextParam) {
  if (!nextParam || typeof nextParam !== "string") return "/";
  if (!nextParam.startsWith("/")) return "/";
  if (nextParam.startsWith("//")) return "/";
  return nextParam;
}

async function establishSession(user) {
  const response = await fetch("/api/auth/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken() }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Could not establish sign-in.");
  }
}

function getSignInMessage(error) {
  if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") return "";
  if (error?.code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  if (error?.code === "auth/network-request-failed") return "A network error interrupted sign-in. Check your connection and try again.";
  return error?.message && !String(error.message).startsWith("Firebase:")
    ? error.message
    : "Could not complete sign-in. Please try again.";
}

export default function LoginClient({
  next = "/",
  showError = false,
  showExpired = false,
  showDenied = false,
}) {
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
        await establishSession(user);
        window.location.replace(safeDestination);
      } catch (error) {
        setMessage(error?.message || "Could not verify sign-in.");
      }
    });

    return () => unsub();
  }, [safeDestination]);

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

      await establishSession(user);
      window.location.replace(safeDestination);
    } catch (error) {
      setMessage(getSignInMessage(error));
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
      {message ? <p className="login-error" role="alert">{message}</p> : null}

      <button
        type="button"
        className="login-submit"
        onClick={handleGoogleSignIn}
        disabled={busy}
      >
        {busy ? "Signing in…" : "Sign in with Google"}
      </button>
    </div>
  );
}
