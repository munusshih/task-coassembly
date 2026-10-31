import test from 'node:test';
import assert from 'node:assert/strict';
import {typographyPreferences,typographyVariables,DEFAULT_TYPOGRAPHY,ORIGINAL_TYPOGRAPHY,TYPE_ROLES} from '../src/app/lib/typography.mjs';
test('typography preferences migrate older saves and reject unknown fonts',()=>{
 assert.deepEqual(typographyPreferences({palette:'garden'}),DEFAULT_TYPOGRAPHY);
 assert.deepEqual(typographyPreferences(ORIGINAL_TYPOGRAPHY),ORIGINAL_TYPOGRAPHY);
 assert.equal(typographyPreferences({fontBody:'unknown'}).fontBody,'instrument');
 assert.equal(typographyPreferences({fontHeading:'url(evil)'}).fontHeading,'assembly');
 assert.match(typographyVariables({fontBody:'typewriter'})['--font-body'],/^"Assembly Typewriter"/);
 assert.equal(typographyVariables(ORIGINAL_TYPOGRAPHY)['--font-body'],'"Instrument Sans", Arial, sans-serif');
});

test('every Assembly style persists for each typography level',()=>{
 for(const role of TYPE_ROLES) for(const font of ['assembly','script','typewriter','mono']) {
  assert.equal(typographyPreferences({[role.key]:font})[role.key],font);
 }
});
