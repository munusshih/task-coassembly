import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { SHARE_ID_PATTERN, SHARE_VERSION, shareDestination, shareId, sharedViewDestination } from "../app/lib/shareUrl.mjs";

export async function saveSharedView(path) {
  if (!auth?.currentUser || !db) throw new Error("Sign in to create a share link.");
  const destination = shareDestination(path);
  const id = await shareId(destination);
  const target = doc(db, "sharedViews", id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(target);
    if (existing.exists()) {
      const data = existing.data();
      if (data.version !== SHARE_VERSION || data.destination !== destination) {
        throw new Error("Could not create this link. Please use the address bar URL.");
      }
      return;
    }
    transaction.set(target, {
      version: SHARE_VERSION,
      destination,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  });
  return `/s/${id}`;
}

export async function resolveSharedView(id) {
  if (!SHARE_ID_PATTERN.test(id)) throw new Error("This share link is invalid.");
  if (!auth?.currentUser || !db) throw new Error("Sign in to open this link.");
  const snapshot = await getDoc(doc(db, "sharedViews", id));
  if (!snapshot.exists()) throw new Error("This share link could not be found.");
  return sharedViewDestination(id, snapshot.data());
}
