import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFirebaseMemberToken } from '../src/lib/firebaseSession.mjs';
import { createFirebaseAuthCookieValue, verifyAuthCookieValue, getUsernameFromAuthCookieValue } from '../src/lib/auth.js';
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const settings = { apiKey: 'test-key', projectId: 'test-project' };

test('rejects invalid Firebase tokens before querying membership', async () => {
  let calls = 0;
  const result = await verifyFirebaseMemberToken('invalid', { ...settings, fetchImpl: async () => { calls++; return json({}, 400); } });
  assert.equal(result, null); assert.equal(calls, 1);
});

test('requires an active member and uses that user token for Firestore rules', async () => {
  for (const active of [true, false]) {
    let calls = 0;
    const result = await verifyFirebaseMemberToken('test-token', { ...settings, fetchImpl: async (url, options) => {
      calls++;
      if (calls === 1) return json({ users: [{ localId: 'valid-uid', emailVerified: true, email: 'member@example.com' }] });
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.equal(JSON.parse(options.body).structuredQuery.where.fieldFilter.field.fieldPath, 'authUid');
      return json([{ document: { name: 'members/test', fields: { active: { booleanValue: active } } } }]);
    } });
    assert.deepEqual(result, active ? { uid: 'valid-uid' } : null);
  }
});

test('unbound accounts require verified email; missing members never get a session', async () => {
  for (const emailVerified of [true, false]) {
    let calls = 0;
    const result = await verifyFirebaseMemberToken('test-token', { ...settings, fetchImpl: async () => {
      calls++;
      return calls === 1 ? json({ users: [{ localId: 'valid-uid', emailVerified, email: 'member@example.com' }] }) : json([]);
    } });
    assert.equal(result, null); assert.equal(calls, emailVerified ? 4 : 2);
  }
});

test('verified email fallback matches membership and upstream failures fail closed', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return calls === 1 ? json({ users: [{ localId: 'valid-uid', emailVerified: true, email: 'MEMBER@example.com' }] }) : calls === 2 ? json([]) : json([{ document: { name: 'members/test', fields: {} } }]); };
  assert.deepEqual(await verifyFirebaseMemberToken('test-token', { ...settings, fetchImpl }), { uid: 'valid-uid' });
  await assert.rejects(verifyFirebaseMemberToken('test-token', { ...settings, fetchImpl: async () => json({}, 503) }));
});

test('Firebase session cookies verify their signature and resist tampering', async () => {
  const cookie = await createFirebaseAuthCookieValue('caseSensitive-UID');
  assert.equal(await verifyAuthCookieValue(cookie), true);
  assert.equal(await getUsernameFromAuthCookieValue(cookie), 'firebase:caseSensitive-UID');
  const [payload, signature] = cookie.split('.');
  const tampered = `${payload.replace('caseSensitive-UID', 'attacker-UID')}.${signature}`;
  assert.equal(await verifyAuthCookieValue(tampered), false);
  assert.equal(await verifyAuthCookieValue(`${payload}.bad-signature`), false);
});
