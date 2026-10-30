import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyMatch, searchableText } from '../src/app/lib/noteSearch.mjs';
import { dateKey, monthDays, shiftMonth } from '../src/app/lib/noteCalendar.mjs';
import { formatPronouns, pronounsForInput } from '../src/app/lib/pronouns.mjs';
test('pronouns format legacy arrays and editable strings without merging labels', () => {
  assert.equal(formatPronouns(['he/him', 'they/them']), 'he/him · they/them');
  assert.equal(pronounsForInput(['he/him', 'they/them']), 'he/him, they/them');
  assert.equal(formatPronouns('he/him, they/them; he/him'), 'he/him · they/them');
  assert.equal(formatPronouns(null), '');
});
test('note search requires an exact phrase and identifies the matching field', () => {
  const fields={ title:'Café planning', content:'<p>Budget &amp; allocation decisions</p>', project:'Protocol' };
  assert.equal(fuzzyMatch(fields,'cafe'),null);
  assert.equal(fuzzyMatch(fields,'café').matchType,'title');
  assert.equal(fuzzyMatch(fields,'budegt'),null);
  assert.equal(fuzzyMatch(fields,'allocaton protocol'),null);
  const match=fuzzyMatch(fields,'allocation decisions');
  assert.equal(match.matchType,'content');
  assert.ok(match.matchText.includes('allocation decisions'));
  assert.equal(fuzzyMatch(fields,'unrelated zebras'), null);
  assert.equal(fuzzyMatch(fields,'<p>'), null);
  assert.equal(searchableText(fields.content), 'budget & allocation decisions');
  assert.ok(fuzzyMatch({content:'這是工作會議記錄'},'工作會議'));
});
test('calendar includes complete Sunday-first weeks and leap days', () => {
  const days=monthDays('2026-10');
  assert.equal(days[0], '2026-09-27');
  assert.equal(days.at(-1), '2026-10-31');
  assert.equal(days.length%7, 0);
  assert.ok(monthDays('2024-02').includes('2024-02-29'));
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  assert.equal(dateKey('invalid'), '');
});
test('note search ignores opaque link fragments and URLs embedded in content',()=>{
 const url='https://docs.google.com/document/d/opaque-id/edit?tab=abc#heading=he';
 assert.equal(fuzzyMatch({title:'Meeting',link:url,content:`<p>Document: ${url}</p>`},'he'),null);
 assert.equal(fuzzyMatch({title:'Meeting',content:'<p><a href="https://example.com/heading">Review the plan</a></p>'},'review').matchType,'content');
});
