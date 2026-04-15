"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Simple markdown-to-html converter for preview
function renderMarkdown(markdown: string): string {
  let html = markdown
    // Headers
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__( .*?)__/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_( .*?)_/g, "<em>$1</em>")
    // Lists
    .replace(/^\* (.*)$/gm, "<li>$1</li>")
    .replace(/^\- (.*)$/gm, "<li>$1</li>")
    // Links
    .replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" class="text-blue-600 hover:underline">$1</a>',
    )
    // Code blocks
    .replace(
      /```([\s\S]*?)```/g,
      '<pre class="bg-slate-100 p-2 rounded text-xs overflow-x-auto"><code>$1</code></pre>',
    )
    // Inline code
    .replace(
      /`(.*?)`/g,
      '<code class="bg-slate-100 px-1 rounded text-xs">$1</code>',
    )
    // Blockquotes
    .replace(
      /^> (.*?)$/gm,
      '<blockquote class="border-l-4 border-slate-300 pl-4 italic">$1</blockquote>',
    )
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br />");

  html = `<p>${html}</p>`;
  return html;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      className={cn("grid gap-2 rounded-lg border border-slate-200", className)}
    >
      <div className="flex gap-1 border-b border-slate-200 p-2">
        <Button
          size="sm"
          variant={mode === "edit" ? "default" : "outline"}
          onClick={() => setMode("edit")}
          className="h-8 gap-2"
        >
          <FileText className="h-4 w-4" />
          Edit
        </Button>
        <Button
          size="sm"
          variant={mode === "preview" ? "default" : "outline"}
          onClick={() => setMode("preview")}
          className="h-8 gap-2"
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>
      </div>

      {mode === "edit" ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={16}
        />
      ) : (
        <div
          className="prose prose-sm max-w-none p-4 text-slate-900"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(value),
          }}
          style={{
            fontSize: "0.875rem",
          }}
        />
      )}

      <div className="border-t border-slate-200 p-2 text-xs text-slate-500">
        <details className="cursor-pointer">
          <summary className="font-medium">Markdown help</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded bg-slate-50 p-2">
            <div>
              <code className="text-xs">**bold**</code>
            </div>
            <div>
              <strong>bold</strong>
            </div>
            <div>
              <code className="text-xs">*italic*</code>
            </div>
            <div>
              <em>italic</em>
            </div>
            <div>
              <code className="text-xs"># Heading</code>
            </div>
            <div>
              <h3 className="text-xs font-bold">Heading</h3>
            </div>
            <div>
              <code className="text-xs">- List item</code>
            </div>
            <div>Bullet point</div>
            <div>
              <code className="text-xs">[Link](url)</code>
            </div>
            <div>
              <a href="#" className="text-blue-600 text-xs">
                Link
              </a>
            </div>
            <div>
              <code className="text-xs">`code`</code>
            </div>
            <div>
              <code className="bg-slate-100 px-1 text-xs">code</code>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
