"use client";

export default function EditorToolbar({ editor, showDateObjectButton = false, onInsertDateObject }) {
  if (!editor) return null;

  const ButtonGroup = ({ children }) => (
    <div className="editor-toolbar-group">{children}</div>
  );

  const ToolBtn = ({ icon, label, active, onClick }) => (
    <button
      className={`toolbar-btn ${active ? "is-active" : ""}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );

  return (
    <div className="editor-toolbar">
      <ButtonGroup>
        <ToolBtn
          icon="B"
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolBtn
          icon="I"
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolBtn
          icon="U"
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
      </ButtonGroup>

      <ButtonGroup>
        <ToolBtn
          icon="H1"
          label="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolBtn
          icon="H2"
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolBtn
          icon="H3"
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
      </ButtonGroup>

      <ButtonGroup>
        <ToolBtn
          icon="•"
          title="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolBtn
          icon="1."
          title="Ordered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </ButtonGroup>

      <ButtonGroup>
        {showDateObjectButton && (
          <ToolBtn
            icon="Date"
            label="Insert date object"
            onClick={() => onInsertDateObject?.()}
          />
        )}
        <ToolBtn
          icon="↶"
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolBtn
          icon="↷"
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </ButtonGroup>
    </div>
  );
}
