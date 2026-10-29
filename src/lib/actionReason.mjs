export function requireActionReason(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Please add a reason.');
  const reason = value.trim();
  if (reason.length > 2000) throw new Error('Keep the reason under 2,000 characters.');
  return reason;
}
export function actionRecord(action, reason, actor = null, now = Date.now()) {
  return { action, reason: requireActionReason(reason), createdBy: actor || null, createdAt: now };
}
