import test from 'node:test';
import assert from 'node:assert/strict';
import {memberTimeSummary} from '../src/app/components/memberTimeSummary.mjs';
test('time summary uses eight-hour days and weekdays across the inclusive period',()=>{
 assert.equal(memberTimeSummary(160,'2026-10-19','2026-10-19'),'≈ 5 eight-hour workdays\n8 team hours per weekday across this period.');
 assert.equal(memberTimeSummary(320,'2026-10-19','2026-10-26'),'≈ 10 eight-hour workdays\n8 team hours per weekday across this period.');
 assert.equal(memberTimeSummary(0,'2026-10-19','2026-10-19'),'');
});
