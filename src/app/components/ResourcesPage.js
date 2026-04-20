"use client";

import { useEffect, useState, useMemo } from "react";
import {
  subscribeCollection,
  createDocument,
  replaceDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";

const DEFAULT_CATEGORIES = ["general", "admin", "projects", "finance", "others"];

function normalizeCategory(value) {
  const next = (value || "").trim().toLowerCase();
  return next || "general";
}

export default function ResourcesPage() {
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ name: "", url: "", category: "general" });
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: "", url: "", category: "general" });
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Subscribe to links
  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeCollection("resources", (items) => {
      setLinks(items.sort((a, b) => Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0)));
    });
  }, []);

  // Filter links based on search
  const filteredLinks = useMemo(() => {
    if (!searchQuery) return links;
    return links.filter((link) => {
      const name = link.data.name || "";
      const url = link.data.url || "";
      const category = link.data.category || "";
      const query = searchQuery.toLowerCase();
      return name.toLowerCase().includes(query) ||
             url.toLowerCase().includes(query) ||
             category.toLowerCase().includes(query);
    });
  }, [links, searchQuery]);

  // Group by category
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
    const existing = links
      .map((link) => normalizeCategory(link.data.category))
      .filter(Boolean);

    const seen = new Set();
    const ordered = [];

    [...DEFAULT_CATEGORIES, ...existing].forEach((cat) => {
      if (seen.has(cat)) return;
      seen.add(cat);
      ordered.push(cat);
    });

    return ordered;
  }, [links]);

  async function handleCreateLink() {
    if (!newLink.name.trim() || !newLink.url.trim()) return;
    const categoryToSave =
      newLink.category === "others"
        ? normalizeCategory(newCustomCategory || "others")
        : normalizeCategory(newLink.category);
    try {
      await createDocument("resources", {
        name: newLink.name.trim(),
        url: newLink.url.trim(),
        category: categoryToSave,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNewLink({ name: "", url: "", category: "general" });
      setNewCustomCategory("");
    } catch (e) {
      console.error("Could not create link:", e);
    }
  }

  async function handleSaveEdit(id, data) {
    const categoryToSave =
      data.category === "others"
        ? normalizeCategory(editCustomCategory || "others")
        : normalizeCategory(data.category);
    try {
      const link = links.find((l) => l.id === id);
      if (link) {
        await replaceDocument("resources", id, {
          ...link.data,
          name: data.name,
          url: data.url,
          category: categoryToSave,
          updatedAt: Date.now(),
        });
        setEditingId(null);
        setEditCustomCategory("");
      }
    } catch (e) {
      console.error("Could not save link:", e);
    }
  }

  async function handleDeleteLink(id) {
    try {
      await deleteDocument("resources", id);
      setPendingDeleteId(null);
    } catch (e) {
      console.error("Could not delete link:", e);
    }
  }

  function renderLinkSection(category, categoryLinks) {
    if (!categoryLinks.length) return null;

    return (
      <div key={category} className="resources-section">
        <h3 className="resources-section-title">{category}</h3>
        <ul className="resources-list">
          {categoryLinks.map((link) => (
            <li key={link.id} className="resource-item">
              <div 
                className="resource-row"
                onClick={() => {
                  if (editingId !== link.id) {
                    window.open(link.data.url, "_blank");
                  }
                }}
              >
                <div className="resource-content-col">
                  <span className="resource-name" style={{ cursor: "pointer" }}>{link.data.name}</span>
                  <span className="resource-url">{link.data.url}</span>
                </div>
                <div className="resource-actions-row">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDeleteId(null);
                      setEditingId(link.id);
                      setEditData({
                        name: link.data.name,
                        url: link.data.url,
                        category: normalizeCategory(link.data.category),
                      });
                      setEditCustomCategory("");
                    }}
                    title="Edit"
                  >
                    ✎
                  </button>
                  {pendingDeleteId === link.id ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteLink(link.id);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPendingDeleteId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn icon-btn--delete"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPendingDeleteId(link.id);
                      }}
                      title="Delete link"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {editingId === link.id && (
                <div className="resource-editor-row">
                  <div className="resource-editor-field">
                    <label className="resource-field-label">Name</label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="resource-input"
                    />
                  </div>
                  <div className="resource-editor-field">
                    <label className="resource-field-label">URL</label>
                    <input
                      type="url"
                      value={editData.url}
                      onChange={(e) => setEditData({ ...editData, url: e.target.value })}
                      className="resource-input"
                    />
                  </div>
                  <div className="resource-editor-field">
                    <label className="resource-field-label">Category</label>
                    <select
                      value={editData.category}
                      onChange={(e) => {
                        const nextCategory = e.target.value;
                        setEditData({ ...editData, category: nextCategory });
                        if (nextCategory !== "others") {
                          setEditCustomCategory("");
                        }
                      }}
                      className="resource-input"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {editData.category === "others" && (
                      <input
                        type="text"
                        value={editCustomCategory}
                        onChange={(e) => setEditCustomCategory(e.target.value)}
                        className="resource-input"
                        placeholder="Type new category"
                      />
                    )}
                  </div>
                  <div className="resource-editor-actions">
                    <button
                      className="btn btn--primary"
                      onClick={() => handleSaveEdit(link.id, editData)}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn--ghost"
                      onClick={() => {
                        setEditingId(null);
                        setEditCustomCategory("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="resources-page">
      <h2 className="section-title">Resources</h2>
      <p className="section-subtitle">{links.length} link{links.length !== 1 ? "s" : ""}</p>

      <div className="new-resource-row">
        <input
          type="text"
          placeholder="Link name..."
          value={newLink.name}
          onChange={(e) => setNewLink({ ...newLink, name: e.target.value })}
          className="resource-input"
        />
        <input
          type="url"
          placeholder="https://example.com"
          value={newLink.url}
          onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
          className="resource-input"
        />
        <div className="resource-category-stack">
          <select
            value={newLink.category}
            onChange={(e) => {
              const nextCategory = e.target.value;
              setNewLink({ ...newLink, category: nextCategory });
              if (nextCategory !== "others") {
                setNewCustomCategory("");
              }
            }}
            className="resource-input"
          >
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {newLink.category === "others" && (
            <input
              type="text"
              value={newCustomCategory}
              onChange={(e) => setNewCustomCategory(e.target.value)}
              className="resource-input"
              placeholder="Type new category"
            />
          )}
        </div>
        <button
          className="btn btn--primary"
          onClick={handleCreateLink}
          disabled={!newLink.name.trim() || !newLink.url.trim()}
        >
          Add
        </button>
      </div>

      <div className="search-row">
        <input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="btn btn--ghost btn--small"
            onClick={() => setSearchQuery("")}
          >
            Clear
          </button>
        )}
      </div>

      <div className="resources-sections">
        {Object.keys(groupedLinks).map((category) =>
          renderLinkSection(category, groupedLinks[category])
        )}

        {links.length === 0 && (
          <p className="empty-state">No resources yet. Add one to get started!</p>
        )}
      </div>
    </div>
  );
}
