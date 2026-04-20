"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import { useMemo } from "react";
import EditorToolbar from "./EditorToolbar";

const MentionExtension = Mention.extend({
  parseHTML() {
    return [
      { tag: "span[data-type='mention']" },
      {
        tag: "span.mention-pill[data-type='member'], span.mention-pill[data-type='project'], span.mention-pill[data-type='task']",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          return {
            kind: node.getAttribute("data-type") || "member",
            id: node.getAttribute("data-id") || node.textContent?.replace(/^@/, "") || "",
            label: node.getAttribute("data-label") || node.textContent?.replace(/^@/, "") || "",
          };
        },
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
    .replace(/data-type="task"/g, 'data-type="mention" data-kind="task"');
}

function buildMentionItems({ members, projects, tasks, query }) {
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

  const all = [...memberItems, ...projectItems, ...taskItems];
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
  return "✓";
}

export default function RichEditor({ value, onChange, members = [], projects = [], tasks = [] }) {
  const mentionSuggestion = useMemo(() => ({
    char: "@",
    items: ({ query }) => buildMentionItems({ members, projects, tasks, query }),
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
  }), [members, projects, tasks]);

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
          return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`;
        },
        renderHTML({ options, node, HTMLAttributes }) {
          return [
            "span",
            mergeAttributes(HTMLAttributes, {
              class: "mention-pill",
              "data-type": "mention",
              "data-kind": node.attrs.kind || "member",
            }),
            `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`,
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

  return (
    <div className="rich-editor">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}
