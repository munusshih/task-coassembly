"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON, EDIT_ICON } from "./icons";

const DEFAULT_CATEGORIES = ["general", "admin", "projects", "finance", "others"];

const EMPTY_FORM = { name: "", url: "", description: "", category: "general", customCategory: "", subLinks: [] };
const EMPTY_SUBLINK = { label: "", url: "" };

function normalizeCategory(value) {
  const next = (value || "").trim().toLowerCase();
  return next || "general";
}

function toLinkHref(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "#";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function SubLinkEditor({ subLinks, onChange }) {
  function update(i, key, val) {
    const next = subLinks.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
    onChange(next);
  }
  function add() { onChange([...subLinks, { ...EMPTY_SUBLINK }]); }
  function remove(i) { onChange(subLinks.filter((_, idx) => idx !== i)); }

  return (
    <div className="resource-sublinks-editor">
      {subLinks.map((sl, i) => (
        <div key={i} className="resource-sublink-row">
          <input
            className="resource-input resource-input--sm"
            type="text"
            placeholder="Label"
            value={sl.label}
            onChange={(e) => update(i, "label", e.target.value)}
          />
          <input
            className="resource-input resource-input--sm"
            type="url"
            placeholder="https://…"
            value={sl.url}
            onChange={(e) => update(i, "url", e.target.value)}
          />
          <button type="button" className="resource-sublink-remove" onClick={() => remove(i)} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="resource-sublink-add" onClick={add}>+ sub-link</button>
    </div>
  );
}

function ResourceForm({ form, setForm, categoryOptions, onSave, onCancel, saveLabel = "Add" }) {
  const effectiveCategory = form.category === "others"
    ? normalizeCategory(form.customCategory || "others")
    : normalizeCategory(form.category);

  return (
    <div className="resource-form">
      <div className="resource-form-main">
        <input
          className="resource-input"
          type="text"
          placeholder="Name *"
          value={form.name}
          autoFocus
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="resource-input"
          type="url"
          placeholder="URL * (https://…)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <select
          className="resource-input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value, customCategory: "" })}
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      {form.category === "others" && (
        <input
          className="resource-input"
          type="text"
          placeholder="New category name"
          value={form.customCategory}
          onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
        />
      )}
      <input
        className="resource-input"
        type="text"
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="resource-form-sublinks-label">Sub-links</div>
      <SubLinkEditor subLinks={form.subLinks} onChange={(sl) => setForm({ ...form, subLinks: sl })} />
      <div className="resource-form-actions">
        <Button onClick={() => onSave(form, effectiveCategory)} disabled={!form.name.trim() || !form.url.trim()}>
          {saveLabel}
        </Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const [links, setLinks] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeCollection("resources", (items) => {
      setLinks(items.sort((a, b) => Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0)));
    });
  }, []);

  const filteredLinks = useMemo(() => {
    if (!searchQuery) return links;
    const q = searchQuery.toLowerCase();
    return links.filter((l) => {
      const d = l.data;
      return (d.name || "").toLowerCase().includes(q) ||
             (d.url || "").toLowerCase().includes(q) ||
             (d.description || "").toLowerCase().includes(q) ||
             (d.category || "").toLowerCase().includes(q);
    });
  }, [links, searchQuery]);

  const groupedLinks = useMemo(() => {
    const grouped = {};
    filteredLinks.forEach((link) => {
      const cat = normalizeCategory(link.data.category);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(link);
    });
    return grouped;
  }, [filteredLinks]);

  const categoryOptions = useMemo(() => {
    const existing = links.map((l) => normalizeCategory(l.data.category)).filter(Boolean);
    const seen = new Set();
    const ordered = [];
    [...DEFAULT_CATEGORIES, ...existing].forEach((cat) => {
      if (seen.has(cat)) return;
      seen.add(cat);
      ordered.push(cat);
    });
    return ordered;
  }, [links]);

  async function handleCreate(form, category) {
    try {
      await createDocument("resources", {
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim(),
        category,
        subLinks: form.subLinks.filter((s) => s.url.trim()),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setAddForm(EMPTY_FORM);
      setAddOpen(false);
    } catch (e) {
      console.error("Could not create link:", e);
    }
  }

  async function handleSaveEdit(form, category) {
    const link = links.find((l) => l.id === editingId);
    if (!link) return;
    try {
      await replaceDocument("resources", editingId, {
        ...link.data,
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim(),
        category,
        subLinks: form.subLinks.filter((s) => s.url.trim()),
        updatedAt: Date.now(),
      });
      setEditingId(null);
    } catch (e) {
      console.error("Could not save link:", e);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteDocument("resources", id);
      setPendingDeleteId(null);
    } catch (e) {
      console.error("Could not delete link:", e);
    }
  }

  function startEdit(link) {
    const d = link.data;
    setEditingId(link.id);
    setEditForm({
      name: d.name || "",
      url: d.url || "",
      description: d.description || "",
      category: normalizeCategory(d.category),
      customCategory: "",
      subLinks: Array.isArray(d.subLinks) ? d.subLinks : [],
    });
    setPendingDeleteId(null);
  }

  return (
    <div className="resources-page">
      <div className="resources-topbar">
        <div className="resources-topbar-left">
          <h2 className="section-title">Resources</h2>
          <span className="resources-count">{links.length} link{links.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="resources-topbar-right">
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="resource-input resource-search"
          />
          {searchQuery && (
            <button type="button" className="resource-search-clear" onClick={() => setSearchQuery("")}>×</button>
          )}
        </div>
      </div>

      {/* Add resource trigger */}
      <button type="button" className="resource-add-trigger" onClick={() => setAddOpen(true)}>
        <span className="resource-add-plus">+</span>
        <span className="resource-add-placeholder">Add a resource…</span>
      </button>

      {/* Sticky note grid */}
      {filteredLinks.length > 0 ? (
        <div className="resources-grid">
          {filteredLinks.map((link) => (
            <div key={link.id} className="resource-sticky">
              <div className="resource-sticky-actions">
                <IconButton onClick={() => startEdit(link)} title="Edit">{EDIT_ICON}</IconButton>
                {pendingDeleteId === link.id ? (
                  <>
                    <Button variant="ghost" size="small" onClick={() => handleDelete(link.id)}>Confirm</Button>
                    <Button variant="ghost" size="small" onClick={() => setPendingDeleteId(null)}>Cancel</Button>
                  </>
                ) : (
                  <IconButton variant="delete" onClick={() => setPendingDeleteId(link.id)} title="Delete">{DELETE_ICON}</IconButton>
                )}
              </div>
              <div className="resource-sticky-body">
                <a
                  className="resource-sticky-name"
                  href={toLinkHref(link.data.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.data.name}
                </a>
                {link.data.description && (
                  <span className="resource-sticky-desc">{link.data.description}</span>
                )}
                {Array.isArray(link.data.subLinks) && link.data.subLinks.filter((s) => s.url).length > 0 && (
                  <div className="resource-sticky-sublinks">
                    {link.data.subLinks.filter((s) => s.url).map((sl, i) => (
                      <a
                        key={i}
                        className="resource-sticky-sublink"
                        href={toLinkHref(sl.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {sl.label || sl.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <span className="resource-sticky-cat">{normalizeCategory(link.data.category)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">{searchQuery ? "No results." : "No resources yet. Add one above!"}</p>
      )}

      {/* Add / Edit modal */}
      {(addOpen || editingId !== null) && (
        <div className="edit-modal-overlay" onClick={() => { setAddOpen(false); setAddForm(EMPTY_FORM); setEditingId(null); }}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span className="edit-modal-title">{editingId ? "Edit resource" : "Add resource"}</span>
              <button type="button" className="edit-modal-close" onClick={() => { setAddOpen(false); setAddForm(EMPTY_FORM); setEditingId(null); }}>✕</button>
            </div>
            <div className="edit-modal-body">
              <ResourceForm
                form={editingId ? editForm : addForm}
                setForm={editingId ? setEditForm : setAddForm}
                categoryOptions={categoryOptions}
                onSave={editingId ? handleSaveEdit : handleCreate}
                onCancel={() => { setAddOpen(false); setAddForm(EMPTY_FORM); setEditingId(null); }}
                saveLabel={editingId ? "Save" : "Add resource"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
