import test from 'node:test';
import assert from 'node:assert/strict';
import {weekForCalendarDay,weekDateLabel} from '../src/app/lib/weekSelection.mjs';
test('calendar selections use the displayed calendar day regardless of workspace timezone',()=>{
 assert.equal(weekForCalendarDay(new Date(2026,9,25,12)), '2026-10-19');
 assert.equal(weekForCalendarDay(new Date(2026,9,26,12)), '2026-10-26');
 assert.equal(weekForCalendarDay(new Date(2027,0,1,12)), '2026-12-28');
 assert.equal(weekForCalendarDay(new Date('invalid')),null);
});
test('week controls display dates, including cross-month and cross-year ranges',()=>{
 assert.equal(weekDateLabel('2026-10-26'),'Oct 26–Nov 1, 2026');
 assert.equal(weekDateLabel('2026-10-19'),'Oct 19–25, 2026');
 assert.equal(weekDateLabel('2026-12-28'),'Dec 28, 2026–Jan 3, 2027');
 assert.equal(weekDateLabel('invalid'),'Choose week');
});
