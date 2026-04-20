"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import { useMemo } from "react";
import EditorToolbar from "./EditorToolbar";

function normalizeMentionAttr(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return "";
  return text;
}

function mentionAttrsFromNode(node, fallbackKind = "member") {
  if (!(node instanceof HTMLElement)) return false;

  const rawType = normalizeMentionAttr(node.getAttribute("data-type"));
  const rawKind = normalizeMentionAttr(node.getAttribute("data-kind"));
  const textLabel = normalizeMentionAttr(node.textContent?.replace(/^@/, ""));
  const idAttr = normalizeMentionAttr(node.getAttribute("data-id"));
  const labelAttr = normalizeMentionAttr(node.getAttribute("data-label"));

  const kind = rawKind || (rawType && rawType !== "mention" ? rawType : "") || fallbackKind;
  const label = labelAttr || textLabel || idAttr;
  const id = idAttr || label;

  return {
    kind: kind || "member",
    id: id || "",
    label: label || "",
  };
}

const MentionExtension = Mention.extend({
  parseHTML() {
    return [
      {
        tag: "span[data-type='mention']",
        getAttrs: (node) => mentionAttrsFromNode(node, "member"),
      },
      {
        tag: "span.mention-pill[data-type='member'], span.mention-pill[data-type='project'], span.mention-pill[data-type='task'], span.mention-pill[data-type='resource'], span.mention-pill[data-type='note']",
        getAttrs: (node) => mentionAttrsFromNode(node, "member"),
      },
    ];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: "member",
      },
    };
  },
});

function normalizeLegacyMentionMarkup(content) {
  if (!content) return "<p></p>";
  return content
    .replace(/data-type="member"/g, 'data-type="mention" data-kind="member"')
    .replace(/data-type="project"/g, 'data-type="mention" data-kind="project"')
    .replace(/data-type="task"/g, 'data-type="mention" data-kind="task"')
    .replace(/data-type="resource"/g, 'data-type="mention" data-kind="resource"')
    .replace(/data-type="note"/g, 'data-type="mention" data-kind="note"');
}

function buildMentionItems({ members, projects, tasks, resources, notes, query, currentNoteId }) {
  const q = (query || "").trim().toLowerCase();

  const memberItems = (members || []).map((m) => ({
    id: m.id,
    label: m.data?.name || m.name || "Unnamed member",
    kind: "member",
  }));

  const projectItems = (projects || []).map((p) => ({
    id: p.id,
    label: p.data?.name || p.name || "Untitled project",
    kind: "project",
  }));

  const taskItems = (tasks || [])
    .filter((t) => !t.data?.archived)
    .map((t) => ({
      id: t.id,
      label: t.data?.text || t.data?.title || "Untitled task",
      kind: "task",
    }));

  const resourceItems = (resources || []).map((r) => ({
    id: r.id,
    label: r.data?.name || r.data?.url || "Untitled resource",
    kind: "resource",
  }));

  const noteItems = (notes || [])
    .filter((n) => n.id !== currentNoteId)
    .map((n) => ({
      id: n.id,
      label: n.data?.title || "Untitled note",
      kind: "note",
    }));

  const all = [...memberItems, ...projectItems, ...taskItems, ...resourceItems, ...noteItems];
  const filtered = !q
    ? all
    : all.filter((item) => {
      const text = `${item.label} ${item.kind}`.toLowerCase();
      return text.includes(q);
      });

  return filtered.slice(0, 8);
}

function mentionKindIcon(kind) {
  if (kind === "member") return "👤";
  if (kind === "project") return "📁";
  if (kind === "resource") return "🔗";
  if (kind === "note") return "📝";
  return "✓";
}

export default function RichEditor({
  value,
  onChange,
  members = [],
  projects = [],
  tasks = [],
  resources = [],
  notes = [],
  currentNoteId = null,
  showDateObjectButton = false,
}) {
  const mentionSuggestion = useMemo(() => ({
    char: "@",
    items: ({ query }) => buildMentionItems({
      members,
      projects,
      tasks,
      resources,
      notes,
      query,
      currentNoteId,
    }),
    render: () => {
      let popup = null;
      let selectedIndex = 0;
      let lastProps = null;

      function positionPopup() {
        if (!popup || !lastProps?.clientRect) return;
        const rect = lastProps.clientRect();
        if (!rect) return;
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.bottom + window.scrollY + 8}px`;
      }

      function renderItems() {
        if (!popup || !lastProps) return;
        const items = lastProps.items || [];
        popup.innerHTML = "";

        const list = document.createElement("div");
        list.className = "mention-list";

        if (!items.length) {
          const empty = document.createElement("div");
          empty.className = "mention-item";
          empty.textContent = "No matches";
          list.appendChild(empty);
        }

        items.forEach((item, idx) => {
          const row = document.createElement("button");
          row.type = "button";
          row.className = `mention-item${idx === selectedIndex ? " mention-item--active" : ""}`;

          const icon = document.createElement("span");
          icon.className = "mention-icon";
          icon.textContent = mentionKindIcon(item.kind);

          const label = document.createElement("span");
          label.className = "mention-label";
          label.textContent = `${item.label} (${item.kind})`;

          row.appendChild(icon);
          row.appendChild(label);
          row.addEventListener("mousedown", (e) => {
            e.preventDefault();
            lastProps.command(item);
          });

          list.appendChild(row);
        });

        popup.appendChild(list);
      }

      return {
        onStart: (props) => {
          selectedIndex = 0;
          lastProps = props;
          popup = document.createElement("div");
          popup.className = "mention-dropdown";
          document.body.appendChild(popup);
          positionPopup();
          renderItems();
        },
        onUpdate: (props) => {
          lastProps = props;
          selectedIndex = 0;
          positionPopup();
          renderItems();
        },
        onKeyDown: ({ event }) => {
          if (!lastProps) return false;
          const len = lastProps.items?.length || 0;
          if (!len) {
            if (event.key === "Escape") {
              if (popup) popup.remove();
              popup = null;
              return true;
            }
            return false;
          }

          if (event.key === "ArrowDown") {
            selectedIndex = (selectedIndex + 1) % len;
            renderItems();
            return true;
          }
          if (event.key === "ArrowUp") {
            selectedIndex = (selectedIndex + len - 1) % len;
            renderItems();
            return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const item = lastProps.items[selectedIndex];
            if (item) lastProps.command(item);
            return true;
          }
          if (event.key === "Escape") {
            if (popup) popup.remove();
            popup = null;
            return true;
          }

          return false;
        },
        onExit: () => {
          if (popup) popup.remove();
          popup = null;
          lastProps = null;
          selectedIndex = 0;
        },
      };
    },
  }), [members, projects, tasks, resources, notes, currentNoteId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: { HTMLAttributes: { class: "editor-paragraph" } },
        heading: { levels: [1, 2, 3] },
        bulletList: { HTMLAttributes: { class: "editor-list" } },
        orderedList: { HTMLAttributes: { class: "editor-list" } },
      }),
      Underline,
      MentionExtension.configure({
        HTMLAttributes: { class: "mention-pill" },
        suggestion: mentionSuggestion,
        renderText({ options, node }) {
          const label = normalizeMentionAttr(node.attrs.label) || normalizeMentionAttr(node.attrs.id);
          return `${options.suggestion.char}${label}`;
        },
        renderHTML({ options, node, HTMLAttributes }) {
          const id = normalizeMentionAttr(node.attrs.id);
          const label = normalizeMentionAttr(node.attrs.label) || id;
          const kind = normalizeMentionAttr(node.attrs.kind) || "member";
          return [
            "span",
            mergeAttributes(HTMLAttributes, {
              class: "mention-pill",
              "data-type": "mention",
              "data-kind": kind,
              "data-id": id,
              "data-label": label,
            }),
            `${options.suggestion.char}${label}`,
          ];
        },
      }),
    ],
    content: normalizeLegacyMentionMarkup(value),
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  }, [mentionSuggestion]);

  if (!editor) return null;

  function insertDateObject() {
    const now = new Date();
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const label = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    editor
      .chain()
      .focus()
      .insertContent(`<span class="date-object" data-type="date-object" data-date="${isoDate}">${label}</span>&nbsp;`)
      .run();
  }

  return (
    <div className="rich-editor">
      <EditorToolbar
        editor={editor}
        showDateObjectButton={showDateObjectButton}
        onInsertDateObject={insertDateObject}
      />
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}
