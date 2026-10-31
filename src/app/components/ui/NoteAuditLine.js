import PersonIdentity from './PersonIdentity';
function Stamp({label,value}) {
 const date=new Date(Number(value)||value);
 if(Number.isNaN(date.getTime()))return null;
 return <div><dt>{label}</dt><dd><time dateTime={date.toISOString()}>{date.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})}<span>{date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span></time></dd></div>;
}
export default function NoteAuditLine({note,members,username}) {
 const name=note.createdByUsername||username;
 return <dl className="note-audit-record"><div><dt>Written by</dt><dd><PersonIdentity name={name} member={members.find(member=>String(member.data?.name||'').toLowerCase()===String(name||'').toLowerCase())}/></dd></div><Stamp label="Created" value={note.createdAt}/>{note.updatedAt&&note.updatedAt!==note.createdAt&&<Stamp label="Last edited" value={note.updatedAt}/>}</dl>;
}
