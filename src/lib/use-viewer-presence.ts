"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useViewerPresence(scope: string) {
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [presenceAvailable, setPresenceAvailable] = useState(Boolean(rtdb));
  const sessionId = useMemo(() => createSessionId(), []);
  // Once we get permission_denied, stop retrying — avoids repeated console spam.
  const permissionDeniedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !rtdb || permissionDeniedRef.current) {
      return;
    }

    const viewersRef = ref(rtdb, `presence/${scope}`);
    const sessionRef = ref(rtdb, `presence/${scope}/${sessionId}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const unsubscribeViewers = onValue(
      viewersRef,
      (snapshot) => {
        const value = snapshot.val() as Record<string, unknown> | null;
        setViewerIds(value ? Object.keys(value) : []);
        setPresenceAvailable(true);
      },
      (error) => {
        if (String(error).includes("permission_denied")) {
          permissionDeniedRef.current = true;
        }
        setPresenceAvailable(false);
        setViewerIds([]);
      },
    );

    const unsubscribeConnection = onValue(
      connectedRef,
      (snapshot) => {
        if (snapshot.val() !== true || permissionDeniedRef.current) {
          return;
        }

        void onDisconnect(sessionRef)
          .remove()
          .catch(() => {
            setPresenceAvailable(false);
          });

        void set(sessionRef, {
          joinedAt: serverTimestamp(),
          path: scope,
        }).catch((error: unknown) => {
          if (String(error).includes("permission_denied")) {
            permissionDeniedRef.current = true;
          }
          setPresenceAvailable(false);
        });
      },
      () => {
        setPresenceAvailable(false);
      },
    );

    return () => {
      unsubscribeViewers();
      unsubscribeConnection();
      if (!permissionDeniedRef.current) {
        void remove(sessionRef);
      }
    };
  }, [scope, sessionId]);

  return {
    viewerCount: viewerIds.length,
    viewerSeeds: viewerIds.slice(0, 4),
    presenceAvailable,
  };
}
