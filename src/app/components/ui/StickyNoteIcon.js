export default function StickyNoteIcon({stack=false,archive=false,count}) {
 if(stack)return <span aria-hidden="true" className="sticky-note-stack"><span className="sticky-note-stack-paper"/><span className="sticky-note-stack-paper"/><span className="sticky-note-stack-paper"><i/><i/><i/>{count!=null&&<b>{count}</b>}</span></span>;
 return <span aria-hidden="true" className={`sticky-note-icon${archive?' sticky-note-icon--archive':''}`}><img src="/illustrations/note-archive.svg" alt=""/></span>;
}
