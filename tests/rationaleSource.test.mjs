import test from 'node:test';
import assert from 'node:assert/strict';
import {withRationaleSource,splitRationaleSource} from '../src/app/lib/rationaleSource.mjs';
import {mergeRationaleDefaults} from '../src/app/components/rationaleNotes.mjs';
test('bylaw references round trip through existing rationale body storage and remain editable',()=>{
 const url='https://bylaws.coassembly.work/bylaws/03-governance/#gov-04';
 const stored=withRationaleSource('Explanation',url);
 assert.deepEqual(splitRationaleSource(stored),{body:'Explanation',sourceUrl:url});
 const [note]=mergeRationaleDefaults([],[{id:'custom',data:{body:stored,pageKey:'members'}}]);
 assert.equal(note.data.body,'Explanation');assert.equal(note.sourceUrl,url);
 assert.equal(withRationaleSource(stored,''),'Explanation');
 assert.equal(withRationaleSource(stored,url),stored);
 for(const invalid of ['javascript:alert(1)','https://example.com/bylaws','https://bylaws.coassembly.work.evil.test/'])assert.throws(()=>withRationaleSource('Text',invalid));
});
