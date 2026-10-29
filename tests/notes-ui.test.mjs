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
test('note search matches content, accents, transpositions and words across fields', () => {
  const fields={ title:'Café planning', content:'<p>Budget &amp; allocation decisions</p>', project:'Protocol' };
  assert.ok(fuzzyMatch(fields,'cafe'));
  assert.ok(fuzzyMatch(fields,'budegt'));
  assert.ok(fuzzyMatch(fields,'allocaton protocol'));
  assert.equal(fuzzyMatch(fields,'unrelated zebras'), null);
  assert.equal(fuzzyMatch(fields,'<p>'), null);
  assert.equal(searchableText(fields.content), 'budget & allocation decisions');
  assert.ok(fuzzyMatch({content:'這是工作會議記錄'},'工作會議'));
});
test('calendar includes complete Monday-first weeks and leap days', () => {
  const days=monthDays('2026-10');
  assert.equal(days[0], '2026-09-28');
  assert.equal(days.at(-1), '2026-11-01');
  assert.equal(days.length%7, 0);
  assert.ok(monthDays('2024-02').includes('2024-02-29'));
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  assert.equal(dateKey('invalid'), '');
});
