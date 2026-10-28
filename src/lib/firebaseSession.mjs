// Validate with Firebase, then query membership under the user's own Firestore rules.
export async function verifyFirebaseMemberToken(idToken, { apiKey, projectId, fetchImpl = fetch }) {
  if (typeof idToken !== "string" || !idToken || idToken.length > 16384) return null;
  if (!apiKey || !projectId) throw new Error("Firebase session is not configured.");
  const response = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    if (response.status >= 500) throw new Error("Firebase sign-in is temporarily unavailable.");
    return null;
  }
  const { users = [] } = await response.json();
  const user = users[0];
  if (!user?.localId || user.disabled) return null;
  async function findMember(field, value) {
    const result = await fetchImpl(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "members" }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } }, limit: 1 } }),
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error("Could not verify workspace membership.");
    const rows = await result.json();
    return rows.find(row => row.document)?.document || null;
  }
  let member = await findMember("authUid", user.localId);
  if (!member && user.emailVerified && user.email) {
    const email = user.email.trim().toLowerCase();
    member = await findMember("emailLower", email) || await findMember("email", email);
  }
  if (!member || member.fields?.active?.booleanValue === false) return null;
  return { uid: user.localId };
}
