import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function findOneByField(field, value) {
  if (!db) return null;
  const snapshot = await getDocs(
    query(collection(db, "members"), where(field, "==", value), limit(1)),
  );
  if (snapshot.empty) return null;
  const row = snapshot.docs[0];
  return { id: row.id, data: row.data() };
}

export async function findMemberForAuth({ uid, email }) {
  const normalizedEmail = normalizeEmail(email);

  if (uid) {
    const byUid = await findOneByField("authUid", String(uid));
    if (byUid) return byUid;
  }

  if (!normalizedEmail) return null;

  const byEmailLower = await findOneByField("emailLower", normalizedEmail);
  if (byEmailLower) return byEmailLower;

  return findOneByField("email", normalizedEmail);
}

export function isMemberEnabled(memberData) {
  return memberData?.active !== false;
}

export function isWorkerOwner(memberData) {
  const role = normalizeMemberRoleValue(memberData?.role);
  return role === "worker-owner";
}

export function normalizeEmailValue(value) {
  return normalizeEmail(value);
}

export function normalizeMemberRoleValue(roleValue) {
  const value = String(roleValue || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (value === "worker-owner" || value === "workerowner") {
    return "worker-owner";
  }
  if (value === "flying-member" || value === "flying") {
    return "flying-member";
  }
  if (value === "external-collaborator" || value === "external") {
    return "external-collaborator";
  }
  if (value === "associate") {
    return "associate";
  }
  return "associate";
}

export function hasLimitedWorkspaceAccess(memberData) {
  const role = normalizeMemberRoleValue(memberData?.role);
  return role === "flying-member" || role === "external-collaborator";
}
