'use client';

import { useState } from 'react';
import RationaleNoteFooter from './RationaleNoteFooter';
import CountBadge from './ui/CountBadge';
import styles from './RationaleBoard.module.css';
import MemberEditButton from './ui/MemberEditButton';
import ModalShell from './ui/ModalShell';
import NoteNumber from './ui/NoteNumber';
import SearchField from './ui/SearchField';
import SelectField from './ui/SelectField';
import StickyNoteIcon from './ui/StickyNoteIcon';
import { filterRationaleGlossary, noteLabel, noteKind, withRationaleNumbers } from './rationaleNotes.mjs';

const pages = {
  members: 'Task',
  memberDirectory: 'Member',
  projects: 'Project',
  backlog: 'Wish',
  meetingNotes: 'Note',
  resources: 'Resource',
  finance: 'Finance',
  payouts: 'Request',
  settings: 'Settings',
};

export default function RationaleGlossary({
  notes,
  member,
  canArchive,
  canCreate,
  canPublish,
  onChallenge,
  onClose,
  onEdit,
  onArchive,
  onDelete,
  editing,
  editor,
  busy,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('newest');
  const visible = filterRationaleGlossary(
    withRationaleNumbers(notes).filter(note=>!note.data.deleted),
    query,
    status,
    sort,
  );

  return (
    <ModalShell
      fullscreen
      title={<span className="asterisks-title">Asterisk <CountBadge>{notes.filter(note=>!note.data.deleted).length}</CountBadge></span>}
      onClose={onClose}
      className={`asterisks-modal ${styles.surface}`}
    >
      <section className="rationale-glossary" aria-label="Asterisks">
        <div className="rationale-glossary-tools">
          <SearchField
            ariaLabel="Search asterisks"
            placeholder="Search rules and ideas…"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
          <label>
            Status
            <SelectField tone="inverse" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="all">All notes</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </SelectField>
          </label>
          <label>
            Sort
            <SelectField tone="inverse" value={sort} onChange={event => setSort(event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
              <option value="page">Page</option>
            </SelectField>
          </label>
        </div>
        <div className="rationale-glossary-list">
          {visible.map(note => (
            <article
              key={note.id}
              className="rationale-note rationale-glossary-item"
              data-kind={noteKind(note).key}
              style={{ '--note-paper': `var(--${noteKind(note).paper})` }}
            >
              <header className="rationale-note-label rationale-glossary-meta">
                <NoteNumber number={note.number} kind={noteKind(note).key} />
                <span>{pages[note.data.pageKey] || note.data.pageKey}</span>
                {note.data.archived&&<span>Archived</span>}

              </header>
              {<>
                  <h3>{note.data.title}</h3>
                  <p>{note.data.body}</p>
                  {!note.data.deleted && canArchive && (
                    <RationaleNoteFooter note={note} onChallenge={canCreate?onChallenge:undefined} busy={busy}>
                        {(note.data.createdBy === member?.id ||
                          (note.builtIn && canPublish)) && (
                          <MemberEditButton
                            name={note.data.title}
                            onClick={() => onEdit(note)}
                          />
                        )}
                        {!note.builtIn && (
                          <button
                            className="rationale-archive-action"
                            aria-label={`${note.data.archived ? 'Unarchive' : 'Archive'} ${noteLabel(note)}`}
                            title={note.data.archived ? 'Unarchive' : 'Archive'}
                            onClick={() => onArchive(note)}
                            disabled={busy}
                          >
                            <StickyNoteIcon archive />
                          </button>
                        )}
                        {note.data.createdBy === member?.id && (
                          <button
                            type="button"
                            className="rationale-delete"
                            aria-label={`Remove ${note.data.title}`}
                            onClick={() => onDelete(note)}
                            disabled={busy}
                          >
                            <img src="/illustrations/cross-symbol.svg" alt=""/>
                          </button>
                        )}
                    </RationaleNoteFooter>
                  )}
                </>}
            </article>
          ))}
        </div>
        {!visible.length && <p>No matching notes.</p>}
      </section>
    </ModalShell>
  );
}
