import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { KanbanCard, MeetingNote, Member, Project, Task } from "@/lib/types";

function getDb() {
    if (!db) {
        throw new Error("Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* environment variables.");
    }
    return db;
}

export function subscribeMembers(onData: (items: Member[]) => void): () => void {
    const membersRef = collection(getDb(), "members");
    return onSnapshot(query(membersRef, orderBy("name")), (snapshot) => {
        onData(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, "id">) })));
    });
}

export function subscribeProjects(onData: (items: Project[]) => void): () => void {
    const projectsRef = collection(getDb(), "projects");
    return onSnapshot(query(projectsRef, orderBy("createdAt", "desc")), (snapshot) => {
        onData(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, "id">) })));
    });
}

export function subscribeTasks(onData: (items: Task[]) => void): () => void {
    const tasksRef = collection(getDb(), "tasks");
    return onSnapshot(query(tasksRef, orderBy("createdAt", "desc")), (snapshot) => {
        onData(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, "id">) })));
    });
}

export function subscribeKanban(onData: (items: KanbanCard[]) => void): () => void {
    const kanbanRef = collection(getDb(), "kanbanCards");
    return onSnapshot(query(kanbanRef, orderBy("createdAt", "desc")), (snapshot) => {
        onData(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KanbanCard, "id">) })));
    });
}

export function subscribeNotes(onData: (items: MeetingNote[]) => void): () => void {
    const notesRef = collection(getDb(), "meetingNotes");
    return onSnapshot(query(notesRef, orderBy("createdAt", "desc")), (snapshot) => {
        onData(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeetingNote, "id">) })));
    });
}

export async function createMember(payload: Omit<Member, "id">): Promise<void> {
    const membersRef = collection(getDb(), "members");
    await addDoc(membersRef, payload);
}

export async function updateMember(id: string, payload: Partial<Omit<Member, "id">>): Promise<void> {
    await updateDoc(doc(getDb(), "members", id), payload);
}

export async function deleteMember(id: string): Promise<void> {
    await deleteDoc(doc(getDb(), "members", id));
}

export async function createProject(payload: Omit<Project, "id">): Promise<void> {
    const projectsRef = collection(getDb(), "projects");
    await addDoc(projectsRef, payload);
}

export async function updateProject(id: string, payload: Partial<Omit<Project, "id">>): Promise<void> {
    await updateDoc(doc(getDb(), "projects", id), payload);
}

export async function deleteProject(id: string): Promise<void> {
    await deleteDoc(doc(getDb(), "projects", id));
}

export async function createTask(payload: Omit<Task, "id">): Promise<void> {
    const tasksRef = collection(getDb(), "tasks");
    await addDoc(tasksRef, payload);
}

export async function updateTask(id: string, payload: Partial<Omit<Task, "id">>): Promise<void> {
    await updateDoc(doc(getDb(), "tasks", id), payload);
}

export async function deleteTask(id: string): Promise<void> {
    await deleteDoc(doc(getDb(), "tasks", id));
}

export async function createCard(payload: Omit<KanbanCard, "id">): Promise<void> {
    const kanbanRef = collection(getDb(), "kanbanCards");
    await addDoc(kanbanRef, payload);
}

export async function updateCard(id: string, payload: Partial<Omit<KanbanCard, "id">>): Promise<void> {
    await updateDoc(doc(getDb(), "kanbanCards", id), payload);
}

export async function deleteCard(id: string): Promise<void> {
    await deleteDoc(doc(getDb(), "kanbanCards", id));
}

export async function createNote(payload: Omit<MeetingNote, "id">): Promise<string> {
    const notesRef = collection(getDb(), "meetingNotes");
    const note = await addDoc(notesRef, payload);
    return note.id;
}

export async function updateNote(id: string, payload: Partial<Omit<MeetingNote, "id">>): Promise<void> {
    await updateDoc(doc(getDb(), "meetingNotes", id), payload);
}

export async function deleteNote(id: string): Promise<void> {
    await deleteDoc(doc(getDb(), "meetingNotes", id));
}
