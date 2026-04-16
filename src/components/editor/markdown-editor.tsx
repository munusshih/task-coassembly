"use client";

import { useEffect, useMemo } from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function legacyMarkdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const safe = escapeHtml(line.trim());

    if (!safe) {
      closeList();
      continue;
    }

    if (safe.startsWith("### ")) {
      closeList();
      html.push(`<h3>${safe.slice(4)}</h3>`);
      continue;
    }

    if (safe.startsWith("## ")) {
      closeList();
      html.push(`<h2>${safe.slice(3)}</h2>`);
      continue;
    }

    if (safe.startsWith("# ")) {
      closeList();
      html.push(`<h1>${safe.slice(2)}</h1>`);
      continue;
    }

    if (safe.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${safe.slice(2)}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${safe}</p>`);
  }

  closeList();
  return html.join("");
}

function normalizeInitialContent(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "<p></p>";
  }

  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return legacyMarkdownToHtml(trimmed);
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      className="h-8 min-w-8 px-2"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
}: MarkdownEditorProps) {
  const normalizedValue = useMemo(
    () => normalizeInitialContent(value),
    [value],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        defaultProtocol: "https",
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing notes...",
      }),
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        class: "rich-editor-content",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (editor.getHTML() !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, normalizedValue]);

  function setLink() {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const nextUrl = window.prompt("Enter link URL", previousUrl || "https://");

    if (nextUrl === null) {
      return;
    }

    const trimmedUrl = nextUrl.trim();
    if (!trimmedUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmedUrl })
      .run();
  }

  return (
    <div
      className={cn(
        "grid gap-0 rounded-md border border-slate-300 bg-white",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-2">
        <ToolbarButton
          title="Undo"
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton
          active={editor?.isActive("heading", { level: 1 })}
          title="Heading 1"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("heading", { level: 2 })}
          title="Heading 2"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("bold")}
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("italic")}
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("bulletList")}
          title="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("orderedList")}
          title="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("blockquote")}
          title="Blockquote"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("link")}
          title="Link"
          onClick={setLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
