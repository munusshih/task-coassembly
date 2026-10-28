import test from 'node:test';
import assert from 'node:assert/strict';
import { tenureText, memberMilestones, calendarDate } from '../src/app/components/memberMilestones.mjs';
test('tenure uses calendar days and freezes at leaving date for inactive members', () => {
 assert.equal(tenureText({joinedOn:'2025-06-03'},'2026-10-28'), 'It’s been 512 days since joining');
 assert.equal(tenureText({joinedOn:'2025-06-03',active:false,leftOn:'2025-06-10'},'2026-10-28'), 'Worked with CoA for 7 days');
 assert.equal(tenureText({joinedOn:'2025-06-03',active:false},'2026-10-28'), 'Worked with CoA · leaving date not set');
 assert.equal(tenureText({joinedOn:'2025-02-30'},'2026-10-28'), 'Join date not set');
});
test('milestones roll over annually, celebrate today and skip anniversaries for inactive members', () => {
 const data={birthday:'2000-09-23',joinedOn:'2025-06-03'};
 assert.equal(memberMilestones(data,'2026-09-23')[0].days,0);
 assert.match(memberMilestones(data,'2026-09-23')[0].text,/today!/);
 assert.equal(memberMilestones(data,'2026-10-28').find(e=>e.key==='birthday').date,'2027-09-23');
 assert.equal(memberMilestones({...data,active:false},'2026-10-28').length,1);
 assert.equal(memberMilestones({},'2026-10-28').length,0);
 assert.equal(memberMilestones({birthday:'2000-02-29'},'2027-02-28')[0].days,0);
});
test('default day follows Taipei midnight', () => {
 assert.equal(calendarDate(Date.parse('2026-10-28T16:30:00Z')),'2026-10-29');
});
