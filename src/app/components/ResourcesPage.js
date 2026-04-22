"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  subscribeCollectionQuery,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../../firestore";
import { firebaseReady } from "../../firebase";
import Button from "./Button";
import IconButton from "./IconButton";
import { DELETE_ICON, EDIT_ICON } from "./icons";
import CollectionLayout from "./ui/CollectionLayout";
import CreateBar from "./ui/CreateBar";
import EmptyState from "./ui/EmptyState";
import EntityCard from "./ui/EntityCard";
import InputField from "./ui/InputField";
import ModalShell from "./ui/ModalShell";
import PageControls from "./ui/PageControls";
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import { resourceTexture } from "./ui/paperTextures";
import SearchField from "./ui/SearchField";
import SelectField from "./ui/SelectField";
import TabPage from "./ui/TabPage";
import ViewToggle from "./ui/ViewToggle";

const DEFAULT_CATEGORIES = [
  "general",
  "admin",
  "projects",
  "finance",
  "others",
];

const POSITIONS_KEY = "coassembly-resources-positions-v1";
const VIEW_MODE_KEY = "coassembly-resources-view-mode-v1";
const FREE_CARD_W = 220;
const FREE_CARD_H = 210;

function loadPositions() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(POSITIONS_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePositions(pos) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos));
  } catch {}
}
function loadViewMode() {
  if (typeof window === "undefined") return "category";
  return window.localStorage.getItem(VIEW_MODE_KEY) || "category";
}
function defaultFreePos(index) {
  const cols = 4;
  return {
    x: (index % cols) * (FREE_CARD_W + 16) + 8,
    y: Math.floor(index / cols) * (FREE_CARD_H + 20) + 8,
  };
}

const EMPTY_FORM = {
  name: "",
  url: "",
  description: "",
  category: "general",
  customCategory: "",
  subLinks: [],
};
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
    const next = subLinks.map((s, idx) =>
      idx === i ? { ...s, [key]: val } : s,
    );
    onChange(next);
  }
  function add() {
    onChange([...subLinks, { ...EMPTY_SUBLINK }]);
  }
  function remove(i) {
    onChange(subLinks.filter((_, idx) => idx !== i));
  }

  return (
    <div className="resource-sublinks-editor">
      {subLinks.map((sl, i) => (
        <div key={i} className="resource-sublink-row">
          <InputField
            className="resource-input resource-input--sm"
            type="text"
            placeholder="Label"
            value={sl.label}
            onChange={(e) => update(i, "label", e.target.value)}
          />
          <InputField
            className="resource-input resource-input--sm"
            type="url"
            placeholder="https://…"
            value={sl.url}
            onChange={(e) => update(i, "url", e.target.value)}
          />
          <button
            type="button"
            className="resource-sublink-remove"
            onClick={() => remove(i)}
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="resource-sublink-add" onClick={add}>
        + sub-link
      </button>
    </div>
  );
}

function ResourceForm({
  form,
  setForm,
  categoryOptions,
  onSave,
  onCancel,
  saveLabel = "Add",
}) {
  const effectiveCategory =
    form.category === "others"
      ? normalizeCategory(form.customCategory || "others")
      : normalizeCategory(form.category);

  return (
    <div className="resource-form">
      <div className="resource-form-main">
        <InputField
          className="resource-input"
          type="text"
          placeholder="Name *"
          value={form.name}
          autoFocus
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <InputField
          className="resource-input"
          type="url"
          placeholder="URL * (https://…)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <SelectField
          className="resource-input"
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value, customCategory: "" })
          }
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </SelectField>
      </div>
      {form.category === "others" && (
        <InputField
          className="resource-input"
          type="text"
          placeholder="New category name"
          value={form.customCategory}
          onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
        />
      )}
      <InputField
        className="resource-input"
        type="text"
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="resource-form-sublinks-label">Sub-links</div>
      <SubLinkEditor
        subLinks={form.subLinks}
        onChange={(sl) => setForm({ ...form, subLinks: sl })}
      />
      <div className="resource-form-actions">
        <Button
          onClick={() => onSave(form, effectiveCategory)}
          disabled={!form.name.trim() || !form.url.trim()}
        >
          {saveLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Shared card renderer ────────────────────────────────────────────────────
function ResourceCard({ link, onEdit, onDelete }) {
  return (
    <EntityCard
      className="resource-sticky"
      texture={resourceTexture(link.data.category)}
      interactive
    >
      <div className="resource-sticky-actions">
        <IconButton onClick={() => onEdit(link)} title="Edit">
          {EDIT_ICON}
        </IconButton>
        <IconButton
          variant="delete"
          onClick={() => onDelete(link)}
          title="Delete"
        >
          {DELETE_ICON}
        </IconButton>
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
        {Array.isArray(link.data.subLinks) &&
          link.data.subLinks.filter((s) => s.url).length > 0 && (
            <div className="resource-sticky-sublinks">
              {link.data.subLinks
                .filter((s) => s.url)
                .map((sl, i) => (
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
      <span className="resource-sticky-cat">
        {normalizeCategory(link.data.category)}
      </span>
    </EntityCard>
  );
}

// ─── Category view ───────────────────────────────────────────────────────────
function CategoryView({ links, categories, onEdit, onDelete }) {
  return (
    <div className="resources-by-category">
      {categories.map((cat) => {
        const items = links.filter(
          (l) => normalizeCategory(l.data.category) === cat,
        );
        if (!items.length) return null;
        return (
          <div key={cat} className="resources-cat-section">
            <h3 className="resources-cat-header">{cat}</h3>
            <CollectionLayout variant="grid" className="resources-grid">
              {items.map((link) => (
                <ResourceCard
                  key={link.id}
                  link={link}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </CollectionLayout>
          </div>
        );
      })}
    </div>
  );
}

// ─── Free-arrange board ──────────────────────────────────────────────────────
const FREE_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="6" height="5" rx="1" />
    <rect x="5" y="1" width="6" height="5" rx="1" />
    <rect x="3" y="7" width="6" height="5" rx="1" />
  </svg>
);
const CATEGORY_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="1" y1="3" x2="13" y2="3" />
    <rect x="1" y="5.5" width="12" height="2.5" rx="0.5" />
    <line x1="1" y1="11" x2="13" y2="11" />
    <rect x="1" y="5.5" width="12" height="2.5" rx="0.5" />
    <line x1="3" y1="3" x2="3" y2="1" />
    <line x1="3" y1="13" x2="3" y2="11" />
  </svg>
);

const VIEW_OPTIONS = [
  { value: "category", title: "Group by category", icon: CATEGORY_ICON },
  { value: "free", title: "Free arrange", icon: FREE_ICON },
];

function FreeBoard({ links, positions, onPositionChange, onEdit, onDelete }) {
  const dragRef = useRef(null);
  const justDragged = useRef(false);

  const boardHeight = useMemo(
    () =>
      Math.max(
        600,
        ...links.map((l, i) => {
          const p = positions[l.id] ?? defaultFreePos(i);
          return p.y + FREE_CARD_H + 60;
        }),
      ),
    [links, positions],
  );

  function startDrag(e, link, index) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = positions[link.id] ?? defaultFreePos(index);
    dragRef.current = {
      id: link.id,
      startPX: e.clientX,
      startPY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      moved: false,
    };
  }

  function moveDrag(e, link, index) {
    if (!dragRef.current || dragRef.current.id !== link.id) return;
    const dx = e.clientX - dragRef.current.startPX;
    const dy = e.clientY - dragRef.current.startPY;
    if (!dragRef.current.moved && Math.hypot(dx, dy) < 5) return;
    dragRef.current.moved = true;
    onPositionChange(link.id, {
      x: Math.max(0, dragRef.current.startX + dx),
      y: Math.max(0, dragRef.current.startY + dy),
    });
  }

  function endDrag(e, link) {
    if (!dragRef.current || dragRef.current.id !== link.id) return;
    justDragged.current = dragRef.current.moved;
    dragRef.current = null;
  }

  function suppressIfDragged(e) {
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      justDragged.current = false;
    }
  }

  return (
    <div className="resources-free-board" style={{ minHeight: boardHeight }}>
      {links.map((link, i) => {
        const pos = positions[link.id] ?? defaultFreePos(i);
        return (
          <div
            key={link.id}
            className="resources-free-card"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            onPointerDown={(e) => startDrag(e, link, i)}
            onPointerMove={(e) => moveDrag(e, link, i)}
            onPointerUp={(e) => endDrag(e, link)}
            onClick={suppressIfDragged}
          >
            <ResourceCard link={link} onEdit={onEdit} onDelete={onDelete} />
          </div>
        );
      })}
    </div>
  );
}

export default function ResourcesPage() {
  const [links, setLinks] = useState([]);
  const [resourcesLimit, setResourcesLimit] = useState(120);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState(() => loadViewMode());
  const [positions, setPositions] = useState(() => loadPositions());

  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  function handlePositionChange(id, pos) {
    setPositions((prev) => {
      const next = { ...prev, [id]: pos };
      savePositions(next);
      return next;
    });
  }

  function handleRequestDelete(link) {
    setPendingDelete({ id: link.id, name: link.data.name || "this resource" });
  }

  useEffect(() => {
    if (!firebaseReady) return;
    return subscribeCollectionQuery(
      "resources",
      {
        orderByField: "createdAt",
        orderDirection: "desc",
        limitCount: resourcesLimit,
      },
      (items) => {
      setLinks(
        items.sort(
          (a, b) =>
            Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0),
        ),
      );
      },
    );
  }, [resourcesLimit]);

  const filteredLinks = useMemo(() => {
    if (!searchQuery) return links;
    const q = searchQuery.toLowerCase();
    return links.filter((l) => {
      const d = l.data;
      return (
        (d.name || "").toLowerCase().includes(q) ||
        (d.url || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q) ||
        (d.category || "").toLowerCase().includes(q)
      );
    });
  }, [links, searchQuery]);

  const categoryOptions = useMemo(() => {
    const existing = links
      .map((l) => normalizeCategory(l.data.category))
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

  // Actual categories present in data (for category view grouping, no 'others' sentinel)
  const dataCategories = useMemo(() => {
    const cats = links
      .map((l) => normalizeCategory(l.data.category))
      .filter(Boolean);
    const unique = [...new Set(cats)];
    return unique.sort((a, b) => {
      const ai = DEFAULT_CATEGORIES.indexOf(a);
      const bi = DEFAULT_CATEGORIES.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
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
    if (!editingId) return;
    try {
      await updateDocument("resources", editingId, {
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
      setPendingDelete(null);
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
    setPendingDelete(null);
  }

  return (
    <TabPage
      className="resources-page"
      title="Resources"
      badge={`${links.length} link${links.length !== 1 ? "s" : ""}`}
      right={
        <PageControls compact>
          <ViewToggle
            value={viewMode}
            options={VIEW_OPTIONS}
            onChange={setViewMode}
          />
          <SearchField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
          />
        </PageControls>
      }
    >
      <CreateBar
        open={false}
        onOpen={() => setAddOpen(true)}
        label="Add a resource…"
        triggerClassName="resource-create-trigger"
      />

      {filteredLinks.length > 0 ? (
        viewMode === "free" ? (
          <FreeBoard
            links={filteredLinks}
            positions={positions}
            onPositionChange={handlePositionChange}
            onEdit={startEdit}
            onDelete={handleRequestDelete}
          />
        ) : (
          <CategoryView
            links={filteredLinks}
            categories={dataCategories}
            onEdit={startEdit}
            onDelete={handleRequestDelete}
          />
        )
      ) : (
        <EmptyState>
          {searchQuery ? "No results." : "No resources yet. Add one above!"}
        </EmptyState>
      )}

      {/* Add / Edit modal */}
      {(addOpen || editingId !== null) && (
        <ModalShell
          title={editingId ? "Edit resource" : "Add resource"}
          onClose={() => {
            setAddOpen(false);
            setAddForm(EMPTY_FORM);
            setEditingId(null);
          }}
        >
          <ResourceForm
            form={editingId ? editForm : addForm}
            setForm={editingId ? setEditForm : setAddForm}
            categoryOptions={categoryOptions}
            onSave={editingId ? handleSaveEdit : handleCreate}
            onCancel={() => {
              setAddOpen(false);
              setAddForm(EMPTY_FORM);
              setEditingId(null);
            }}
            saveLabel={editingId ? "Save" : "Add resource"}
          />
        </ModalShell>
      )}

      {pendingDelete && (
        <DeleteConfirmDialog
          label={pendingDelete.name}
          onConfirm={() => handleDelete(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {links.length >= resourcesLimit && (
        <div className="notes-load-more-row">
          <Button
            variant="ghost"
            onClick={() => setResourcesLimit((prev) => prev + 120)}
          >
            Load more resources
          </Button>
        </div>
      )}
    </TabPage>
  );
}
