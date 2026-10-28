export function resourceRevision(data) {
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
    return value;
  }
  return JSON.stringify(canonical(data));
}
export function resourceDate(value) {
  const milliseconds = value?.seconds ? value.seconds * 1000 : typeof value === "string" && !/^\d+$/.test(value) ? Date.parse(value) : Number(value);
  return milliseconds > 0 && Number.isFinite(milliseconds) ? new Date(milliseconds) : null;
}
export function contributorName(data, members = []) {
  const submitter = data.submittedBy || data.createdBy;
  if (submitter?.name) return submitter.name;
  if (data.createdByName || data.submittedByName || data.authorName) return data.createdByName || data.submittedByName || data.authorName;
  const identity = typeof submitter === "string" ? submitter : submitter?.id || data.memberId;
  return (members || []).find((member) => member.id === identity || member.data?.name === identity)?.data?.name || "Unknown contributor";
}
