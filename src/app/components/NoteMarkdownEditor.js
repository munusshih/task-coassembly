'use client';

import {useMemo, useRef, useState} from 'react';
import CodeMirror, {EditorView} from '@uiw/react-codemirror';
import {markdown} from '@codemirror/lang-markdown';
import {languages} from '@codemirror/language-data';
import prose from './ui/NoteProse.module.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './NoteMarkdownEditor.module.css';

export function NoteMarkdownPreview({ source }) {
  return (
    <div className={`${styles.previewText} ${prose.prose}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source || ''}</ReactMarkdown>
    </div>
  );
}

export default function NoteMarkdownEditor({value, onChange, onSelectionChange}) {
  const [mode, setMode] = useState('write');
  const editor = useRef(null);
  const extensions = useMemo(() => [markdown({codeLanguages: languages}), EditorView.lineWrapping, EditorView.theme({
    '&': {height: '100%', fontSize: 'calc(var(--type-body) * .85)'},
    '.cm-scroller': {overflow: 'auto', fontFamily: 'var(--font-body)', lineHeight: '1.8'},
    '.cm-content': {maxWidth: '800px', width: '100%', margin: '0 auto', padding: '36px 28px 45vh', boxSizing: 'border-box'},
    '.cm-line': {padding: '0'},
    '&.cm-focused': {outline: 'none'},
    '.cm-gutters': {display: 'none'},
    '.cm-activeLine': {backgroundColor: 'transparent'},
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {backgroundColor: '#dce9ff'},
    '.cm-cursor': {borderLeftColor: 'var(--ink)'},
  })], []);
  function insert(before, after = '', fallback = 'text') {
    const view = editor.current;
    if (!view) return;
    const {from, to} = view.state.selection.main;
    const text = view.state.sliceDoc(from, to) || fallback;
    view.dispatch({changes: {from, to, insert: before + text + after}, selection: {anchor: from + before.length, head: from + before.length + text.length}});
    view.focus();
  }
  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <div className={styles.tools} role="group" aria-label="Markdown formatting">
        <button type="button" title="Heading" aria-label="Heading" disabled={mode==='preview'} onClick={()=>insert('## ', '', 'Heading')}>H₂</button>
        <button type="button" title="Bold" aria-label="Bold" disabled={mode==='preview'} onClick={()=>insert('**','**')}><strong>B</strong></button>
        <button type="button" title="Italic" aria-label="Italic" disabled={mode==='preview'} onClick={()=>insert('*','*')}><em>I</em></button>
        <button type="button" title="Link" aria-label="Link" disabled={mode==='preview'} onClick={()=>insert('[','](https://)', 'Link text')}>Link</button>
        <button type="button" title="Bullet list" aria-label="Bullet list" disabled={mode==='preview'} onClick={()=>insert('- ', '', 'List item')}>List</button>
        <button type="button" title="Task list" aria-label="Task list" disabled={mode==='preview'} onClick={()=>insert('- [ ] ', '', 'Task')}>☐</button>
        <button type="button" title="Quote" aria-label="Quote" disabled={mode==='preview'} onClick={()=>insert('> ', '', 'Quote')}>“</button>
        <button type="button" title="Code" aria-label="Code" disabled={mode==='preview'} onClick={()=>insert('`','`', 'code')}>〈/〉</button>
      </div>
      <div className={styles.modes} role="group" aria-label="Editor view">{['write','split','preview'].map(item=><button type="button" key={item} aria-pressed={mode===item} onClick={()=>setMode(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div>
    </div>
    <div className={`${styles.panes} ${mode==='split'?styles.split:''}`}>
      <section className={styles.source} aria-label="Markdown source" hidden={mode==='preview'}>
        <CodeMirror value={value} height="100%" extensions={extensions} basicSetup={{lineNumbers:false, foldGutter:false, highlightActiveLine:false, highlightActiveLineGutter:false}} placeholder="Start writing…" aria-label="Note content in Markdown" onCreateEditor={view=>{editor.current=view;}} onChange={next=>onChange(next)} onUpdate={update=>{if(update.selectionSet) {const selection=update.state.selection.main; onSelectionChange?.({anchor:selection.anchor+1,head:selection.head+1});}}}/>
      </section>
      {mode!=='write' && <section className={styles.preview} aria-label="Markdown preview"><NoteMarkdownPreview source={value}/></section>}
    </div>
    <div className={styles.status}><span>Markdown · {value.trim() ? value.trim().split(/\s+/u).length.toLocaleString() : 0} words</span><span>⌘ / Ctrl F to find</span></div>
  </div>;
}
