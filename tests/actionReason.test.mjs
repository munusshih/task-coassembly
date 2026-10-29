import test from 'node:test';
import assert from 'node:assert/strict';
import { requireActionReason, actionRecord } from '../src/lib/actionReason.mjs';
test('decisions and deletions reject blank reasons and keep a durable actor and timestamp', () => {
 for (const value of ['', '   ', null, undefined, 10]) assert.throws(() => requireActionReason(value));
 assert.throws(() => requireActionReason('a'.repeat(2001)));
 assert.deepEqual(actionRecord('approve','  Ready to share  ','member-1',123), {action:'approve',reason:'Ready to share',createdBy:'member-1',createdAt:123});
 assert.equal(actionRecord('delete', 'Duplicate item').reason, 'Duplicate item');
});
