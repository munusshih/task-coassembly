import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_APP_NAME = "coassembly-admin";

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function initializeAdminApp() {
  if (getApps().some((app) => app.name === ADMIN_APP_NAME)) {
    return getApp(ADMIN_APP_NAME);
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    }, ADMIN_APP_NAME);
  }

  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
  );
}

export function getAdminDb() {
  const app = initializeAdminApp();
  return getFirestore(app);
}
