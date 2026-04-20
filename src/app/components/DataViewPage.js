"use client";

import { useEffect, useMemo, useState } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

const COLLECTION_MAP = {
  projects: "projects",
  tasks: "tasks",
  kanban: "kanbanCards",
  meetingNotes: "meetingNotes",
};

export default function DataViewPage({ tabKey }) {
  const collectionName = COLLECTION_MAP[tabKey];
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("{}");
  const [newDraft, setNewDraft] = useState('{\n  "createdAt": 0\n}');
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseReady || !collectionName) return;
    setSelectedId("");
    setStatus("");
    setError("");
    return subscribeCollection(collectionName, (items) => {
      setDocuments(items);
      const next = items[0] || null;
      if (next) {
        setSelectedId((prev) => {
          const found = items.find((i) => i.id === prev);
          if (found) return prev;
          setDraft(formatJson(next.data));
          return next.id;
        });
      } else {
        setSelectedId("");
        setDraft("{}");
      }
    });
  }, [collectionName]);

  const selectedDocument = useMemo(
    () => documents.find((d) => d.id === selectedId) || documents[0],
    [documents, selectedId],
  );

  async function handleSave() {
    if (!selectedDocument) return;
    try {
      setError("");
      const parsed = JSON.parse(draft);
      await replaceDocument(collectionName, selectedDocument.id, parsed);
      setStatus(`Saved ${selectedDocument.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }

  async function handleCreate() {
    try {
      setError("");
      const parsed = JSON.parse(newDraft);
      const id = await createDocument(collectionName, parsed);
      setSelectedId(id);
      setStatus(`Created ${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create.");
    }
  }

  async function handleDelete() {
    if (!selectedDocument) return;
    if (!window.confirm(`Delete ${selectedDocument.id}?`)) return;
    try {
      setError("");
      await deleteDocument(collectionName, selectedDocument.id);
      setStatus(`Deleted ${selectedDocument.id}`);
      setSelectedId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  return (
    <div>
      <h2 className="section-title">{tabKey}</h2>
      <p className="section-subtitle">{documents.length} document{documents.length !== 1 ? "s" : ""} in <code>{collectionName}</code></p>

      <section className="workspace">
        <div className="panel">
          <h3>Documents</h3>
          <div className="document-list">
            {documents.length ? (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className={
                    doc.id === selectedDocument?.id
                      ? "document-item document-item--active"
                      : "document-item"
                  }
                  onClick={() => {
                    setSelectedId(doc.id);
                    setDraft(formatJson(doc.data));
                  }}
                >
                  <strong>{doc.id}</strong>
                  <span>{Object.keys(doc.data).length} fields</span>
                </button>
              ))
            ) : (
              <p className="empty-state">No documents.</p>
            )}
          </div>
        </div>

        <div className="panel editor-panel">
          <div className="panel-header">
            <div>
              <h3>Selected</h3>
              <p>{selectedDocument ? selectedDocument.id : "—"}</p>
            </div>
            <div className="button-row">
              <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!selectedDocument}>
                Save
              </button>
              <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={!selectedDocument}>
                Delete
              </button>
            </div>
          </div>
          <textarea
            className="json-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="panel editor-panel">
          <div className="panel-header">
            <div>
              <h3>New document</h3>
              <p>Create in {collectionName}</p>
            </div>
            <button type="button" className="btn btn--primary" onClick={handleCreate}>
              Create
            </button>
          </div>
          <textarea
            className="json-input"
            value={newDraft}
            onChange={(e) => setNewDraft(e.target.value)}
            spellCheck={false}
          />
        </div>
      </section>

      {status && <p className="message message--ok">{status}</p>}
      {error && <p className="message message--error">{error}</p>}
    </div>
  );
}
