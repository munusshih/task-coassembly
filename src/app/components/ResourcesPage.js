"use client";

import CrossIcon from "./ui/CrossIcon";


import useUrlState from "../hooks/useUrlState";
import { useEffect, useState, useMemo } from "react";
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
import DeleteConfirmDialog from "./ui/DeleteConfirmDialog";
import SelectField from "./ui/SelectField";
import TabPage from "./ui/TabPage";
import { resourceDate, contributorName } from "./resourceMetadata.mjs";
import { COVER_COLORS } from "./ui/palette";
import ResourcePreviewImage from "./ResourcePreviewImage";
import WorkspacePageHero from "./ui/WorkspacePageHero";

const DEFAULT_CATEGORIES = [
  "general",
  "admin",
  "projects",
  "finance",
  "others",
];

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
            <CrossIcon />
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
function ResourceCard({ link, onEdit, onDelete, members = [] }) {
  return (
    <EntityCard
      className="resource-sticky"
      interactive
    >
      <div className="resource-folder-cover" style={{ backgroundColor: COVER_COLORS[Array.from(link.id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 6] }}><ResourcePreviewImage link={link} /></div>
      <svg className="resource-folder-outline" viewBox="0 0 260 220" preserveAspectRatio="none" aria-hidden="true"><path d="M2 20 L12 2 H77 L88 14 H258 V218 H2 Z" fill="none" stroke="#000" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>
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
      <span className="resource-submission">
        {contributorName(link.data, members) !== "Unknown contributor" && <span>{contributorName(link.data, members)}</span>}
        <time dateTime={resourceDate(link.data.createdAt)?.toISOString()}>{resourceDate(link.data.createdAt)?.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) || "Date unavailable"}</time>
      </span>
    </EntityCard>
  );
}

// ─── Category view ───────────────────────────────────────────────────────────
function CategoryView({ links, categories, onEdit, onDelete, members }) {
  return (
    <div className="resources-by-category">
      {categories.map((cat) => {
        const items = links.filter(
          (l) => normalizeCategory(l.data.category) === cat,
        );
        if (!items.length) return null;
        return (
          <div key={cat} className="resources-cat-section">
            <h3 className="resources-cat-header">{cat}<span className="task-scope-count">{items.length}</span></h3>
            <CollectionLayout variant="grid" className="resources-grid">
              {items.map((link) => (
                <ResourceCard
                  key={link.id}
                  link={link}
                  members={members}
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

function DateView({ links, onEdit, onDelete, members }) {
  const groups = new Map();
  [...links].sort((a, b) => (resourceDate(b.data.createdAt)?.getTime() || 0) - (resourceDate(a.data.createdAt)?.getTime() || 0)).forEach((link) => {
    const date = resourceDate(link.data.createdAt);
    const label = date?.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) || "Date unavailable";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(link);
  });
  return <div className="resources-by-date">{[...groups].map(([label, items]) => <section key={label} className="resources-cat-section"><h3 className="resources-cat-header">{label}<span className="task-scope-count">{items.length}</span></h3><CollectionLayout variant="grid" className="resources-grid">{items.map((link) => <ResourceCard key={link.id} link={link} members={members} onEdit={onEdit} onDelete={onDelete} />)}</CollectionLayout></section>)}</div>;
}

export default function ResourcesPage({ currentMember, members = [] }) {
  const [links, setLinks] = useState([]);
  const [resourcesLimit, setResourcesLimit] = useState(120);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [viewMode, setViewMode] = useUrlState("resourcesView", "category", { allowed: ["category", "date"] });

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
        ...(currentMember?.id ? { submittedBy: { id: currentMember.id, name: currentMember.name || "Unnamed member" } } : {}),
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

  async function handleDelete(id, reason) {
    try {
      await deleteDocument("resources", id, reason);
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
      title="Resource"
      header={<WorkspacePageHero title="Resource" illustration="book-carrier">
        <label className="task-view-picker"><span>by</span><select className="task-view-selector" aria-label="Resource view" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
          <option value="category">Category</option><option value="date">Date</option>
        </select></label>
      </WorkspacePageHero>}
    >
      <div className="resource-board-controls">
      <CreateBar
        open={false}
        onOpen={() => setAddOpen(true)}
        label="Add a resource…"
        triggerClassName="resource-create-trigger"
      />
      </div>

      {links.length > 0 ? (viewMode === "date"
        ? <DateView links={links} members={members} onEdit={startEdit} onDelete={handleRequestDelete} />
        : <CategoryView links={links} categories={dataCategories} members={members} onEdit={startEdit} onDelete={handleRequestDelete} />
      ) : <EmptyState>No resources yet. Add one above!</EmptyState>}

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
          onConfirm={(reason) => handleDelete(pendingDelete.id, reason)}
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
