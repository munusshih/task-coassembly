export function normalizePronouns(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).flatMap(item => String(item || '').split(/[,;·]+/)).map(item => item.trim()).filter(Boolean))];
}
export function formatPronouns(value) { return normalizePronouns(value).join(', '); }
export function pronounsForInput(value) { return normalizePronouns(value).join(', '); }
