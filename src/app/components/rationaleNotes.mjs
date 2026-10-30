export const RATIONALE_PAGES = ['members','memberDirectory','projects','backlog','resources','meetingNotes','finance','payouts','settings','homepage'];
export function validateRationale({ pageKey, title, body,position,anchor,archived,kind }) {
  if (!RATIONALE_PAGES.includes(pageKey)) throw new Error('Unknown workspace page.');
  if (!String(title || '').trim() || String(title).length > 120) throw new Error('Give the note a title of up to 120 characters.');
  if (!String(body || '').trim() || String(body).length > 3000) throw new Error('Add an explanation of up to 3,000 characters.');
  const layout={};
  if(position !== undefined){
    if(!position || !Number.isFinite(position.x)||!Number.isFinite(position.y)||position.x<0||position.x>1||position.y<0||position.y>1)throw new Error('Invalid note position.');
    layout.position={x:position.x,y:position.y};
  }
  if(anchor !== undefined){if(anchor!==null&&(typeof anchor!=='string'||! /^[A-Za-z0-9:_-]{1,180}$/.test(anchor)))throw new Error('Invalid note anchor.');layout.anchor=anchor;}
  if(kind !== undefined){if(!NOTE_KINDS.some(item=>item.key===kind))throw new Error('Unknown sticky note kind.');layout.kind=kind;}
  if(archived !== undefined){if(typeof archived!=='boolean')throw new Error('Invalid archive state.');layout.archived=archived;}
  return {pageKey,title:title.trim(),body:body.trim(),...layout};
}
export function assertRationaleRevision(current, expectedRevision) {
  if ((current?.revision || 0) !== expectedRevision) throw new Error('Someone edited this note while you were writing. Cancel and reopen it to see their changes.');
}
// Sticky notes are authored interface discussions. The driver tour owns instructions.
export function rationaleDefaults() { return []; }

export function assertRationaleAuthor(note,memberId) {
 if(!note || !memberId || note.createdBy !== memberId) throw new Error('Only the member who created this note can edit, move, or delete it.');
}
export function noteLabel(id) {
 let hash=2166136261;
 for(const char of String(id)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
 const value=hash>>>0;
 return `#${value.toString(36).toUpperCase().slice(-3).padStart(3,'0')}`;
}
export function groupRationalePiles(notes) {
 const piles=new Map();
 for(const note of notes){const key=note.data.anchor?`anchor:${note.data.anchor}`:`note:${note.id}`;if(!piles.has(key))piles.set(key,[]);piles.get(key).push(note);}
 return [...piles.entries()].map(([id,notes])=>({id,notes}));
}
export function filterRationaleGlossary(notes,query='',status='all',sort='newest') {
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return notes.filter(note=>{
  const state=note.data.deleted?'deleted':note.data.archived?'archived':'active';
  if(status!=='all'&&state!==status)return false;
  const haystack=[noteLabel(note.id),note.data.title,note.data.body,note.data.pageKey,note.data.createdByName].join(' ').toLowerCase();
  return terms.every(term=>haystack.includes(term));
 }).sort((a,b)=>sort==='title'?a.data.title.localeCompare(b.data.title):sort==='oldest'?(a.data.createdAt||0)-(b.data.createdAt||0):sort==='page'?a.data.pageKey.localeCompare(b.data.pageKey):(b.data.createdAt||0)-(a.data.createdAt||0));
}

export const NOTE_KINDS=[
 {key:'why',label:'Why',symbol:'*',paper:'palette-planned'},
 {key:'rule',label:'Rule',symbol:'!',paper:'palette-date'},
 {key:'guide',label:'How-to',symbol:'↗',paper:'palette-project'},
 {key:'question',label:'Question',symbol:'?',paper:'palette-blue'},
 {key:'decision',label:'Decision',symbol:'✓',paper:'palette-worked'},
];
export function noteKind(note){if(note.live)return {key:'live',label:'Live',symbol:'↻',paper:'surface-quiet'};const kind=note.data.kind||(note.id.endsWith('-share-results')?'rule':note.id.endsWith('-shared-plan')||note.id.endsWith('-estimates')?'guide':'why');return NOTE_KINDS.find(item=>item.key===kind)||NOTE_KINDS[0];}
