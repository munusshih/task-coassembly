import test from 'node:test';
import assert from 'node:assert/strict';
import { rationaleDefaults,mergeRationaleDefaults,validateRationale,assertRationaleRevision } from '../src/app/components/rationaleNotes.mjs';
test('shared rationale notes validate content and page membership before saving',()=>{
 assert.deepEqual(validateRationale({pageKey:'members',title:' Why ',body:' Context '}),{pageKey:'members',title:'Why',body:'Context'});
 for(const fields of [{pageKey:'unknown',title:'x',body:'y'},{pageKey:'members',title:' ',body:'y'},{pageKey:'members',title:'x',body:'a'.repeat(3001)}]) assert.throws(()=>validateRationale(fields));
});
test('editing an explanation detects both simultaneous updates and concurrent first saves',()=>{
 assert.doesNotThrow(()=>assertRationaleRevision(null,0));
 assert.doesNotThrow(()=>assertRationaleRevision({revision:2},2));
 assert.throws(()=>assertRationaleRevision({revision:1},0),/Someone edited/);
 assert.throws(()=>assertRationaleRevision({revision:3},2),/Someone edited/);
});
test('bylaw rationales appear only on the pages they inform and include their source',()=>{
 const members=rationaleDefaults('members',['Tasks','Shared plan']);
 assert.equal(members.length,1);
 assert.match(members[0].data.body,/General Assembly/);
 assert.equal(members[0].sourceLabel,'Chapter 3 · Governance');
 assert.equal(members[0].builtIn,true);
 assert.ok(rationaleDefaults('backlog').some(note=>note.data.kind==='rule'));
 assert.match(rationaleDefaults('projects')[0].sourceLabel,/PROJ-01/);
 assert.equal(rationaleDefaults().length,7);
});

test('saved edits can override built-in text without losing its bylaw source',()=>{
 const seed=rationaleDefaults('meetingNotes');
 const merged=mergeRationaleDefaults(seed,[{id:seed[0].id,data:{pageKey:'meetingNotes',title:'Updated title',body:'Updated body',revision:1}}]);
 assert.equal(merged.length,1);
 assert.equal(merged[0].builtIn,false);
 assert.equal(merged[0].sourceUrl,seed[0].sourceUrl);
 assert.equal(merged[0].data.title,'Updated title');
});

test('editing, moving, and deleting require the recorded author',async()=>{
 const {assertRationaleAuthor}=await import('../src/app/components/rationaleNotes.mjs');
 assert.doesNotThrow(()=>assertRationaleAuthor({createdBy:'mor'},'mor'));
 assert.throws(()=>assertRationaleAuthor({createdBy:'mor'},'tzu'),/Only the member/);
 assert.throws(()=>assertRationaleAuthor(null,'mor'));
 assert.throws(()=>assertRationaleAuthor({createdBy:'mor'},null));
});

test('note layouts validate coordinates and stable anchors',()=>{
 const base={pageKey:'members',title:'Why',body:'Because'};
 assert.deepEqual(validateRationale({...base,position:{x:.2,y:.7},anchor:'focus-clock',archived:true}).position,{x:.2,y:.7});
 assert.throws(()=>validateRationale({...base,position:{x:-1,y:.2}}));
 assert.throws(()=>validateRationale({...base,anchor:'[invalid selector]'}));
 assert.equal(validateRationale({...base,anchor:null}).anchor,null);
});
test('notes sharing a page anchor form one pile, without mixing free notes',async()=>{
 const {groupRationalePiles,noteLabel,filterRationaleGlossary}=await import('../src/app/components/rationaleNotes.mjs');
 const notes=[{id:'one',data:{pageKey:'members',anchor:'focus-clock',title:'Focus',body:'Why we focus',createdAt:1}},{id:'two',data:{pageKey:'members',anchor:'focus-clock',title:'Second note',body:'Another reason',createdAt:2,archived:true}},{id:'three',data:{pageKey:'projects',title:'Projects',body:'A plan',createdAt:3,deleted:true}}];
 assert.deepEqual(groupRationalePiles(notes).map(pile=>pile.notes.length),[2,1]);
 assert.equal(noteLabel('one'),noteLabel('one'));assert.notEqual(noteLabel('one'),noteLabel('two'));
 assert.deepEqual(filterRationaleGlossary(notes,'why focus').map(note=>note.id),['one']);
 assert.deepEqual(filterRationaleGlossary(notes,'','archived').map(note=>note.id),['two']);
 assert.deepEqual(filterRationaleGlossary(notes,'','all','newest').map(note=>note.id),['three','two','one']);
});

test('numbered note labels remain stable within each page and note kinds are validated',async()=>{
 const {noteLabel,NOTE_KINDS,withRationaleNumbers}=await import('../src/app/components/rationaleNotes.mjs');
 assert.match(noteLabel('members-shared-plan'),/^#[A-Z0-9]{3}$/);
 assert.equal(noteLabel('members-shared-plan'),noteLabel('members-shared-plan'));
 assert.equal(new Set(['members-shared-plan','members-why-time','members-share-results','members-estimates'].map(noteLabel)).size,4);
 const numbered=withRationaleNumbers([
  {id:'later',data:{pageKey:'members',createdAt:20}},
  {id:'earlier',data:{pageKey:'members',createdAt:10}},
  {id:'other-page',data:{pageKey:'projects',createdAt:5}},
 ]);
 assert.deepEqual(numbered.map(note=>note.number),[2,1,1]);
 assert.equal(noteLabel(numbered[0]),'#2');
 const draft={pageKey:'members',title:'Why',body:'Because'};
 for(const kind of NOTE_KINDS)assert.equal(validateRationale({...draft,kind:kind.key}).kind,kind.key);
 assert.throws(()=>validateRationale({...draft,kind:'unknown'}));
});
