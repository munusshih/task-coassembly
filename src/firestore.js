import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

function getDb() {
  if (!db) {
    throw new Error(
      "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables.",
    );
  }

  return db;
}

function sortDocuments(items) {
  return [...items].sort((left, right) => {
    const leftCreatedAt = Number(left.data.createdAt) || 0;
    const rightCreatedAt = Number(right.data.createdAt) || 0;

    if (leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    const leftName = String(left.data.name || left.id).toLowerCase();
    const rightName = String(right.data.name || right.id).toLowerCase();
    return leftName.localeCompare(rightName);
  });
}

export function subscribeCollection(collectionName, onData) {
  const collectionRef = collection(getDb(), collectionName);

  return onSnapshot(collectionRef, (snapshot) => {
    const documents = snapshot.docs.map((snapshotDocument) => ({
      id: snapshotDocument.id,
      data: snapshotDocument.data(),
    }));

    onData(sortDocuments(documents));
  });
}

export async function fetchCollection(collectionName) {
  const collectionRef = collection(getDb(), collectionName);
  const snapshot = await getDocs(collectionRef);
  const documents = snapshot.docs.map((snapshotDocument) => ({
    id: snapshotDocument.id,
    data: snapshotDocument.data(),
  }));
  return sortDocuments(documents);
}

export function subscribeCollectionQuery(
  collectionName,
  options,
  onData,
) {
  const collectionRef = collection(getDb(), collectionName);
  const constraints = [];
  const whereClauses = Array.isArray(options?.whereClauses)
    ? options.whereClauses
    : [];

  for (const clause of whereClauses) {
    if (!clause || !clause.field || !clause.op) continue;
    constraints.push(where(clause.field, clause.op, clause.value));
  }

  if (options?.orderByField) {
    constraints.push(
      orderBy(options.orderByField, options.orderDirection || "desc"),
    );
  }

  if (Number.isFinite(Number(options?.limitCount)) && Number(options.limitCount) > 0) {
    constraints.push(limit(Number(options.limitCount)));
  }

  const source = constraints.length
    ? query(collectionRef, ...constraints)
    : collectionRef;

  return onSnapshot(source, (snapshot) => {
    const documents = snapshot.docs.map((snapshotDocument) => ({
      id: snapshotDocument.id,
      data: snapshotDocument.data(),
    }));

    onData(sortDocuments(documents));
  });
}

export async function createDocument(collectionName, payload) {
  const collectionRef = collection(getDb(), collectionName);
  const documentRef = await addDoc(collectionRef, payload);
  return documentRef.id;
}

export async function replaceDocument(collectionName, id, payload) {
  await setDoc(doc(getDb(), collectionName, id), payload);
}

export async function updateDocument(collectionName, id, payload) {
  await updateDoc(doc(getDb(), collectionName, id), payload);
}

export async function updateDocumentsAtomically(operations) {
  if (!Array.isArray(operations) || operations.length === 0) return;
  if (operations.length > 500) {
    throw new Error("Too many documents to update in one operation.");
  }

  const database = getDb();
  const batch = writeBatch(database);
  operations.forEach(({ collectionName, id, payload }) => {
    batch.update(doc(database, collectionName, id), payload);
  });
  await batch.commit();
}

export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(getDb(), collectionName, id));
}

export async function deleteDocumentsWhereBefore(
  collectionName,
  field,
  cutoffTs,
  maxDelete = 100,
) {
  const collectionRef = collection(getDb(), collectionName);
  const snapshot = await getDocs(
    query(
      collectionRef,
      where(field, "<", Number(cutoffTs) || 0),
      limit(Math.max(1, Number(maxDelete) || 100)),
    ),
  );

  if (snapshot.empty) return 0;

  await Promise.all(snapshot.docs.map((row) => deleteDoc(row.ref)));
  return snapshot.docs.length;
}
