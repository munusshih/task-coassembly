"use client";
import FormActions from './ui/FormActions';

import WorkspaceViewPicker from "./ui/WorkspaceViewPicker";
import CrossIcon from "./ui/CrossIcon";
import EditButton from "./ui/EditButton";


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
import FormField from "./ui/FormField";
import WorkspaceCreateDock from "./ui/WorkspaceCreateDock";
import BottomComposer from "./ui/BottomComposer";
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
};

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
        <FormField label="Name"><InputField
          className="resource-input"
          type="text"
          placeholder="Name *"
          value={form.name}
          autoFocus
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        /></FormField>
        <FormField label="URL"><InputField
          className="resource-input"
          type="url"
          placeholder="URL * (https://…)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        /></FormField>
        <FormField label="Category"><SelectField
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
        </SelectField></FormField>
      </div>
      {form.category === "others" && (
        <FormField label="New category"><InputField
          className="resource-input"
          type="text"
          placeholder="New category name"
          value={form.customCategory}
          onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
        /></FormField>
      )}
      <FormField label="Description"><InputField
        className="resource-input"
        type="text"
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      /></FormField>
      <FormActions className="resource-form-actions">
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
      </FormActions>
    </div>
  );
}

// ─── Shared card renderer ────────────────────────────────────────────────────
function ResourceCard({ link, onEdit, onDelete, members = [] }) {
  const date=resourceDate(link.data.createdAt);
  const author=contributorName(link.data,members);
  const tone=COVER_COLORS[Array.from(link.id).reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%COVER_COLORS.length];
  return <article className="resource-list-card" data-rationale-anchor={`resource-${link.id}`} data-rationale-label={link.data.name||'Resource'}>
    <a className="resource-list-image" style={{background:tone}} href={toLinkHref(link.data.url)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.data.name}`}><span>{link.data.name}</span><ResourcePreviewImage link={link}/></a>
    <div className="resource-list-copy"><div className="resource-list-meta">{author!=='Unknown contributor'&&<span>{author}</span>}{date&&<time dateTime={date.toISOString()}>{date.toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'})}</time>}</div>
      <a className="resource-list-title resource-card-main-link" href={toLinkHref(link.data.url)} target="_blank" rel="noopener noreferrer">{link.data.name}</a>
      {link.data.description&&<p>{link.data.description}</p>}

      <div className="resource-list-actions"><EditButton label={`Edit ${link.data.name}`} onClick={()=>onEdit(link)}/><IconButton aria-label={`Delete ${link.data.name}`} title="Delete resource" onClick={()=>onDelete(link)}>{DELETE_ICON}</IconButton></div>
    </div>
  </article>;
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
    });
    setPendingDelete(null);
  }

  const ResourceFormShell = editingId !== null ? ModalShell : BottomComposer;
  return (
    <TabPage
      className="resources-page"
      title="Resource"
      header={<WorkspacePageHero title="Resource" illustration="resource-balancer">
        <WorkspaceViewPicker label="Resource view" value={viewMode} onChange={setViewMode} options={[{value:"category",label:"Category"},{value:"date",label:"Chronology"}]} />
      </WorkspacePageHero>}
    >
      <div className="resource-board-controls">
      <WorkspaceCreateDock label="New resource" expanded={addOpen} onClick={() => setAddOpen(true)} />
      </div>

      {links.length > 0 ? (viewMode === "date"
        ? <DateView links={links} members={members} onEdit={startEdit} onDelete={handleRequestDelete} />
        : <CategoryView links={links} categories={dataCategories} members={members} onEdit={startEdit} onDelete={handleRequestDelete} />
      ) : <EmptyState>No resources yet. Add one above!</EmptyState>}

      {/* Creation shares the workspace composer; existing records retain their editor. */}
      {(addOpen || editingId !== null) && (
        <ResourceFormShell
          {...(editingId === null ? { illustration: "compose-resource" } : {})}
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
        </ResourceFormShell>
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
