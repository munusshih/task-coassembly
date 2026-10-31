import test from 'node:test';
import assert from 'node:assert/strict';
import {typographyPreferences,typographyVariables,DEFAULT_TYPOGRAPHY,ORIGINAL_TYPOGRAPHY} from '../src/app/lib/typography.mjs';
test('typography preferences migrate older saves and reject unsupported per-role fonts',()=>{
 assert.deepEqual(typographyPreferences({palette:'garden'}),DEFAULT_TYPOGRAPHY);
 assert.deepEqual(typographyPreferences(ORIGINAL_TYPOGRAPHY),ORIGINAL_TYPOGRAPHY);
 assert.equal(typographyPreferences({fontBody:'script'}).fontBody,'instrument');
 assert.equal(typographyPreferences({fontHeading:'url(evil)'}).fontHeading,'assembly');
 assert.match(typographyVariables({fontBody:'typewriter'})['--font-body'],/^"Assembly Typewriter"/);
 assert.equal(typographyVariables(ORIGINAL_TYPOGRAPHY)['--font-body'],'"Instrument Sans", Arial, sans-serif');
});
