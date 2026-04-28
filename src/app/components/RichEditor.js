"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { mergeAttributes, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import Typography from "@tiptap/extension-typography";
import Suggestion from "@tiptap/suggestion";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useMemo, useRef } from "react";
import EditorToolbar from "./EditorToolbar";

const collabCursorPluginKey = new PluginKey("collab-cursor");

function normalizeMentionAttr(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
    return "";
  }
  return text;
}

function mentionAttrsFromNode(node, fallbackKind = "member") {
  if (!(node instanceof HTMLElement)) return false;

  const rawType = normalizeMentionAttr(node.getAttribute("data-type"));
  const rawKind = normalizeMentionAttr(node.getAttribute("data-kind"));
  const textLabel = normalizeMentionAttr(node.textContent?.replace(/^@/, ""));
  const idAttr = normalizeMentionAttr(node.getAttribute("data-id"));
  const labelAttr = normalizeMentionAttr(node.getAttribute("data-label"));

  const kind =
    rawKind ||
    (rawType && rawType !== "mention" ? rawType : "") ||
    fallbackKind;
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

const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {},
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

function createCollaborationCursorExtension(collaboratorsRef) {
  return Extension.create({
    name: "collaborationCursorDecorations",

    addProseMirrorPlugins() {
      function buildDecorations(state) {
        const collaborators = Array.isArray(collaboratorsRef.current)
          ? collaboratorsRef.current
          : [];
        if (!collaborators.length) return DecorationSet.empty;

        const maxPos = state.doc.content.size;
        const widgets = collaborators
          .map((collaborator) => {
            const rawPos = Number(collaborator?.cursorAnchor);
            const position = Number.isFinite(rawPos)
              ? Math.max(0, Math.min(Math.floor(rawPos), maxPos))
              : null;
            if (position === null) return null;

            const marker = document.createElement("span");
            marker.className = "collab-cursor-marker";

            const caret = document.createElement("span");
            caret.className = "collab-cursor-caret";
            const color = String(collaborator?.color || "#2f5a9c");
            caret.style.backgroundColor = color;
            marker.appendChild(caret);

            const label = document.createElement("span");
            label.className = "collab-cursor-label";
            label.style.backgroundColor = color;
            label.textContent = String(collaborator?.username || "Editor");
            marker.appendChild(label);

            return Decoration.widget(position, marker, {
              key: `collab-${collaborator?.id || collaborator?.username || position}`,
              side: 1,
            });
          })
          .filter(Boolean);

        return DecorationSet.create(state.doc, widgets);
      }

      return [
        new Plugin({
          key: collabCursorPluginKey,
          state: {
            init: (_, state) => buildDecorations(state),
            apply: (tr, _old, _oldState, newState) => {
              const shouldRefresh = Boolean(tr.getMeta("refreshCollabCursor"));
              if (!shouldRefresh && !tr.docChanged && !tr.selectionSet) {
                return _old;
              }
              return buildDecorations(newState);
            },
          },
          props: {
            decorations(state) {
              return this.getState(state);
            },
          },
        }),
      ];
    },
  });
}

function normalizeLegacyMentionMarkup(content) {
  if (!content) return "<p></p>";
  return content
    .replace(/data-type="member"/g, 'data-type="mention" data-kind="member"')
    .replace(/data-type="project"/g, 'data-type="mention" data-kind="project"')
    .replace(/data-type="task"/g, 'data-type="mention" data-kind="task"')
    .replace(
      /data-type="resource"/g,
      'data-type="mention" data-kind="resource"',
    )
    .replace(/data-type="note"/g, 'data-type="mention" data-kind="note"');
}

function buildMentionItems({
  members,
  projects,
  tasks,
  resources,
  notes,
  query,
  currentNoteId,
}) {
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

  const all = [
    ...memberItems,
    ...projectItems,
    ...taskItems,
    ...resourceItems,
    ...noteItems,
  ];

  const filtered = !q
    ? all
    : all.filter((item) => {
        const text = `${item.label} ${item.kind}`.toLowerCase();
        return text.includes(q);
      });

  return filtered.slice(0, 8);
}

function buildSlashItems(editor) {
  return [
    {
      title: "Heading 1",
      hint: "Large section heading",
      command: (range) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
    },
    {
      title: "Heading 2",
      hint: "Medium section heading",
      command: (range) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
    },
    {
      title: "Heading 3",
      hint: "Small section heading",
      command: (range) =>
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
    },
    {
      title: "Bullet list",
      hint: "Unordered list",
      command: (range) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: "Numbered list",
      hint: "Ordered list",
      command: (range) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: "Blockquote",
      hint: "Quote block",
      command: (range) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: "Divider",
      hint: "Horizontal rule",
      command: (range) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: "Date object",
      hint: "Insert current date chip",
      command: (range) => {
        const now = new Date();
        const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const label = now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            `<span class="date-object" data-type="date-object" data-date="${isoDate}">${label}</span>&nbsp;`,
          )
          .run();
      },
    },
  ];
}

function buildSuggestionRenderer(containerClassName, renderRowText) {
  return () => {
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

        const label = document.createElement("span");
        label.className = "mention-label";
        label.textContent = renderRowText(item);

        row.appendChild(label);
        row.addEventListener("mousedown", (event) => {
          event.preventDefault();
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
        popup.className = containerClassName;
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
            popup?.remove();
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
          popup?.remove();
          popup = null;
          return true;
        }
        return false;
      },
      onExit: () => {
        popup?.remove();
        popup = null;
        lastProps = null;
        selectedIndex = 0;
      },
    };
  };
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
  collaborators = [],
  onSelectionChange,
}) {
  const mentionSourceRef = useRef({
    members,
    projects,
    tasks,
    resources,
    notes,
    currentNoteId,
  });
  const collaboratorsRef = useRef(collaborators);
  const isInternalUpdateRef = useRef(false);
  const collabCursorExtension = useMemo(
    () => createCollaborationCursorExtension(collaboratorsRef),
    [],
  );

  useEffect(() => {
    mentionSourceRef.current = {
      members,
      projects,
      tasks,
      resources,
      notes,
      currentNoteId,
    };
  }, [members, projects, tasks, resources, notes, currentNoteId]);

  useEffect(() => {
    collaboratorsRef.current = collaborators;
  }, [collaborators]);

  const mentionSuggestion = useMemo(
    () => ({
      char: "@",
      items: ({ query }) => {
        const source = mentionSourceRef.current;
        return buildMentionItems({
          members: source.members,
          projects: source.projects,
          tasks: source.tasks,
          resources: source.resources,
          notes: source.notes,
          query,
          currentNoteId: source.currentNoteId,
        });
      },
      render: buildSuggestionRenderer(
        "mention-dropdown",
        (item) => `${item.label} (${item.kind})`,
      ),
    }),
    [],
  );

  const slashSuggestion = useMemo(
    () => ({
      char: "/",
      startOfLine: true,
      allowSpaces: true,
      items: ({ editor, query }) => {
        const q = String(query || "").trim().toLowerCase();
        const commands = buildSlashItems(editor).filter((item) =>
          showDateObjectButton ? true : item.title !== "Date object",
        );
        if (!q) return commands;
        return commands.filter((item) => {
          const haystack = `${item.title} ${item.hint}`.toLowerCase();
          return haystack.includes(q);
        });
      },
      command: ({ editor, range, props }) => {
        props.command(range);
      },
      render: buildSuggestionRenderer(
        "slash-dropdown",
        (item) => `${item.title} - ${item.hint}`,
      ),
    }),
    [showDateObjectButton],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          paragraph: { HTMLAttributes: { class: "editor-paragraph" } },
          heading: { levels: [1, 2, 3] },
          bulletList: { HTMLAttributes: { class: "editor-list" } },
          orderedList: { HTMLAttributes: { class: "editor-list" } },
        }),
        Underline,
        Typography,
        collabCursorExtension,
        MentionExtension.configure({
          HTMLAttributes: { class: "mention-pill" },
          suggestion: mentionSuggestion,
          renderText({ options, node }) {
            const label =
              normalizeMentionAttr(node.attrs.label) ||
              normalizeMentionAttr(node.attrs.id);
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
        SlashCommandExtension.configure({
          suggestion: slashSuggestion,
        }),
      ],
      content: normalizeLegacyMentionMarkup(value),
      immediatelyRender: false,
      onUpdate: ({ editor: ed }) => {
        isInternalUpdateRef.current = true;
        onChange(ed.getHTML());
      },
      onSelectionUpdate: ({ editor: ed }) => {
        onSelectionChange?.({
          anchor: ed.state.selection.anchor,
          head: ed.state.selection.head,
        });
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    const normalized = normalizeLegacyMentionMarkup(value);
    if (editor.getHTML() === normalized) return;

    const selection = editor.state.selection;
    editor.commands.setContent(normalized, { emitUpdate: false });

    const size = editor.state.doc.content.size;
    const anchor = Math.min(selection.anchor, size);
    const head = Math.min(selection.head, size);
    editor.commands.setTextSelection({ anchor, head });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta("refreshCollabCursor", Date.now()));
  }, [editor, collaborators]);

  if (!editor) return null;

  function insertDateObject() {
    const now = new Date();
    const isoDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const label = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    editor
      .chain()
      .focus()
      .insertContent(
        `<span class="date-object" data-type="date-object" data-date="${isoDate}">${label}</span>&nbsp;`,
      )
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
