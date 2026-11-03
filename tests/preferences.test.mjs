import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,preferenceVariables,preferenceAttributes,DEFAULT_PREFERENCES,paletteColors,foregroundFor} from '../src/app/lib/preferences.mjs';
test('older and malformed browser preferences migrate to safe functional defaults',()=>{
 assert.deepEqual(normalizePreferences(null),DEFAULT_PREFERENCES);
 assert.equal(normalizePreferences({fontHeading:'script'}).fontHeading,'script');
 for(const focusMinutes of [0,241,1.5,'oops'])assert.equal(normalizePreferences({focusMinutes}).focusMinutes,25);
 assert.equal(normalizePreferences({editorMode:'javascript:bad',focusMode:'bad',readingWidth:'100000px'}).editorMode,'write');
 assert.equal(normalizePreferences({focusMinutes:240}).focusMinutes,240);
});
test('each palette overrides every semantic token and restores original clock colors',()=>{
 for(const palette of ['original','garden','dusk']){
  const colors=paletteColors({palette}),variables=preferenceVariables({palette});
  for(const [key,color] of Object.entries(colors))assert.equal(variables[`--palette-${key}`],color);
 }
 assert.equal(preferenceVariables({palette:'original'})['--cover-4'],'#c3bbdf');
 assert.equal(preferenceVariables({palette:'garden'})['--cover-4'],'#b3cfc9');
});
test('custom color tokens reject CSS injection and choose legible label ink',()=>{
 const preferences=normalizePreferences({palette:'custom',customColors:{project:'#000000',worked:'url(https://bad)',planned:'#ABCDEF'}});
 assert.equal(preferences.customColors.planned,'#abcdef');
 assert.equal(preferences.customColors.worked,DEFAULT_PREFERENCES.customColors.worked);
 assert.equal(preferenceVariables(preferences)['--on-project'],'#ffffff');
 assert.equal(foregroundFor('#ffffff'),'#000000');
});
test('writing, density, motion and timer defaults survive round trips independently',()=>{
 const value=normalizePreferences(JSON.parse(JSON.stringify({...DEFAULT_PREFERENCES,editorMode:'split',noteGuides:false,readingWidth:'wide',focusMode:'stopwatch',focusMinutes:45,compact:true,reduceMotion:true})));
 assert.equal(value.editorMode,'split');assert.equal(value.focusMode,'stopwatch');assert.equal(value.focusMinutes,45);
 assert.equal(preferenceVariables(value)['--note-reading-width'],'1040px');
 assert.equal(preferenceVariables(value)['--workspace-item-space'],'6px');
 assert.deepEqual(preferenceAttributes(value),{motion:'reduced',density:'compact',textSize:'standard',contrast:'standard',noteGuides:'off'});
});
