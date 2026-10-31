import ActionLink from './ui/ActionLink';
/** Shared source/action order for the floating note and glossary. */
export default function RationaleNoteFooter({note,children,onChallenge,busy}) {
 return <footer className="rationale-note-footer"><div className="rationale-note-actions">{note.sourceUrl&&<ActionLink href={note.sourceUrl}>{note.sourceLabel||'Bylaw source'}</ActionLink>}{children}</div>{note.data.createdByName&&<small>By {note.data.createdByName}</small>}</footer>;
}
