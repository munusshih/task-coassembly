export default function StickyNoteIcon({stack=false,archive=false}) {
 return <span aria-hidden="true" className={`sticky-note-icon${stack?' sticky-note-icon--stack':''}${archive?' sticky-note-icon--archive':''}`}>
  {stack?<><img src="/illustrations/sticky-paper.svg" alt=""/><img src="/illustrations/sticky-paper.svg" alt=""/><img src="/illustrations/sticky-paper.svg" alt=""/></>:<img src="/illustrations/note-archive.svg" alt=""/>}
 </span>;
}
