import test from 'node:test';
import assert from 'node:assert/strict';
import {weekStartForDateKey,weekKeyToIsoWeek,weekStartForIsoWeek} from '../src/app/components/taskBoardRules.js';

test('calendar dates resolve to the Monday of their shared workspace week',()=>{
 assert.equal(weekStartForDateKey('2026-10-26'),'2026-10-26');
 assert.equal(weekStartForDateKey('2026-10-28'),'2026-10-26');
 assert.equal(weekStartForDateKey('2026-11-01'),'2026-10-26');
 assert.equal(weekStartForDateKey('2026-11-02'),'2026-11-02');
});

test('invalid calendar date keys are rejected',()=>{
 assert.equal(weekStartForDateKey('2026-02-29'),null);
 assert.equal(weekStartForDateKey('not-a-date'),null);
 assert.equal(weekStartForDateKey(''),null);
});

test('week picker values represent whole ISO weeks, not arbitrary dates',()=>{
 assert.equal(weekKeyToIsoWeek('2026-10-26'),'2026-W44');
 assert.equal(weekStartForIsoWeek('2026-W44'),'2026-10-26');
 assert.equal(weekKeyToIsoWeek('2024-12-30'),'2025-W01');
 assert.equal(weekStartForIsoWeek('2025-W01'),'2024-12-30');
 assert.equal(weekStartForIsoWeek('2020-W53'),'2020-12-28');
 assert.equal(weekKeyToIsoWeek('2026-10-28'),'');
 assert.equal(weekStartForIsoWeek('2021-W53'),null);
 assert.equal(weekStartForIsoWeek('2026-W00'),null);
});
