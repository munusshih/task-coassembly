import {splitRationaleSource} from '../lib/rationaleSource.mjs';
export const RATIONALE_PAGES = ['members','memberDirectory','projects','backlog','resources','meetingNotes','finance','payouts','settings','homepage'];
const GOVERNANCE_SOURCE = 'https://bylaws.coassembly.work/bylaws/03-governance/';
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
const bylawNotes = [
  {
    id:'bylaw-projects-traceability',pageKey:'projects',kind:'why',
    title:'A project keeps its commitments visible',
    body:'Contracts, quotations, receipts, and deliveries must be traceable under PROJ-01. This project view brings the plan and supporting records together. The hour limit is a planning aid, not a bylaw requirement. Question the plan or its assumptions before treating a chart as a decision.',
    sourceUrl:'https://bylaws.coassembly.work/bylaws/05-projects-conflicts/#proj-01',sourceLabel:'PROJ-01 · Project records',
  },
  {
    id:'bylaw-projects-shared-review',pageKey:'backlog',kind:'why',
    title:'A proposal is an invitation to decide together',
    body:'PROJ-02 requires at least two worker-owners, including the proposer, to agree to project budgets, allocations, costs, and outsourcing. The brief makes those commitments concrete enough to question. Support counts and a board status do not replace the required agreement or recorded discussion.',
    sourceUrl:'https://bylaws.coassembly.work/bylaws/05-projects-conflicts/#proj-02',sourceLabel:'PROJ-02 · Shared approval',
  },
  {
    id:'bylaw-resource-shared-records',pageKey:'resources',kind:'guide',
    title:'Shared records should be easy to revisit',
    body:'GOV-04 requires meeting records to be available to members. A shared link helps people find supporting material again. Linking a document here is a convenience, not approval of its contents; ask a question when a source or decision needs review.',
    sourceUrl:'https://bylaws.coassembly.work/bylaws/03-governance/#gov-04',sourceLabel:'GOV-04 · Accessible meeting records',
  },

  {
    id: 'bylaw-governance-members',
    pageKey: 'members',
    kind: 'why',
    title: 'Worker-owners make decisions together',
    body: 'The General Assembly is CoAssembly’s highest internal decision-making body. It includes all worker-owners, including associate worker-owners, and meets at least quarterly to review major policies, finances, and member matters.',
  },
  {
    id: 'bylaw-governance-proposals',
    pageKey: 'backlog',
    kind: 'rule',
    title: 'Major proposals need shared agreement',
    body: 'When a proposal is a major decision, governance calls for discussion and consensus before action. If consensus is not reached after three full discussions, a vote requires two-thirds of all worker-owners; absent members still count in the total.',
  },
  {
    id: 'bylaw-governance-notes',
    pageKey: 'meetingNotes',
    kind: 'guide',
    title: 'Keep decisions traceable',
    body: 'For major decisions, keep an agenda, discussion record, resolution text, responsible person, and deadline. Meeting records should include attendees, discussion points, resolutions, and vote results, and be available to members within 14 days.',
  },
  {
    id: 'bylaw-governance-finance',
    pageKey: 'finance',
    kind: 'why',
    title: 'Review finances together each quarter',
    body: 'Quarterly General Assembly reviews include profit and loss, project allocations, company-pool receipts and reserve status, asset changes, and risk items.',
  },
];

// These are cited governance rationales, not onboarding instructions; Driver.js owns the tour.
export function rationaleDefaults(pageKey) {
  return bylawNotes
    .filter(note => !pageKey || note.pageKey === pageKey)
    .map(note => ({
      id: note.id,
      builtIn: true,
      sourceUrl: note.sourceUrl||GOVERNANCE_SOURCE,
      sourceLabel: note.sourceLabel||'Chapter 3 · Governance',
      data: {
        pageKey: note.pageKey,
        title: note.title,
        body: note.body,
        kind: note.kind,
        createdAt: 0,
        revision: 0,
      },
    }));
}

export function mergeRationaleDefaults(defaults, savedNotes) {
  const defaultsById = new Map(defaults.map(note => [note.id, note]));
  const savedIds = new Set(savedNotes.map(note => note.id));
  const mergedSaved = savedNotes.map(note => {
    const seed = defaultsById.get(note.id);
    const citation=splitRationaleSource(note.data.body);
    return {...seed,...note,builtIn:false,sourceUrl:citation.sourceUrl||seed?.sourceUrl,sourceLabel:citation.sourceUrl?'Bylaw source':seed?.sourceLabel,data:{...seed?.data,...note.data,body:citation.body}};
  });
  return [
    ...defaults.filter(note => !savedIds.has(note.id)),
    ...mergedSaved,
  ];
}

export function assertRationaleAuthor(note,memberId) {
 if(!note || !memberId || note.createdBy !== memberId) throw new Error('Only the member who created this note can edit, move, or delete it.');
}
export function withRationaleNumbers(notes) {
 const ordered=[...notes].sort((a,b)=>{
  const timestamp=value=>typeof value==='number'?value:typeof value==='string'?Date.parse(value)||0:value?.toMillis?.()||0;
  const left=timestamp(a.data.createdAt);
  const right=timestamp(b.data.createdAt);
  return left-right||String(a.id).localeCompare(String(b.id));
 });
 const numbers=new Map();
 const pageNumbers=new Map();
 for(const note of ordered){
  const pageKey=note.data.pageKey;
  const number=(pageNumbers.get(pageKey)||0)+1;
  pageNumbers.set(pageKey,number);
  numbers.set(note.id,number);
 }
 return notes.map(note=>({...note,number:numbers.get(note.id)}));
}
export function noteLabel(noteOrId) {
 if(noteOrId&&typeof noteOrId==='object'&&Number.isInteger(noteOrId.number))return `#${noteOrId.number}`;
 const id=typeof noteOrId==='object'?noteOrId.id:noteOrId;
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
  const haystack=[noteLabel(note),note.data.title,note.data.body,note.data.pageKey,note.data.createdByName].join(' ').toLowerCase();
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
