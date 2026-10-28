const DAY = 86400000;
export function calendarDate(now = Date.now(), timeZone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}
export function tenureText(data, today = calendarDate()) {
  const start = dateValue(data.joinedOn);
  if (start === null) return 'Not set';
  const end = dateValue(data.active === false ? data.leftOn : today);
  if (end === null) return 'Not set';
  const days = Math.max(0, Math.floor((end - start) / DAY));
  const years = Math.floor(days / 365);
  const remainder = days % 365;
  const duration = years ? `${years} ${years === 1 ? 'year' : 'years'}${remainder ? ` and ${remainder} ${remainder === 1 ? 'day' : 'days'}` : ''}` : `${days} ${days === 1 ? 'day' : 'days'}`;
  return data.active === false ? `Worked with CoA for ${duration}` : `It’s been ${duration} since joining`;
}
function nextOccurrence(original, today) {
  if (dateValue(original) === null || dateValue(today) === null) return null;
  const monthDay = original.slice(5);
  const year = Number(today.slice(0, 4));
  for (let candidateYear = year; candidateYear <= year + 1; candidateYear++) {
    // Celebrate leap-day birthdays on February 28 in non-leap years.
    let candidate = `${candidateYear}-${monthDay}`;
    if (dateValue(candidate) === null && monthDay === '02-29') candidate = `${candidateYear}-02-28`;
    if (candidate >= today && candidate >= original) return { date: candidate, days: (dateValue(candidate) - dateValue(today)) / DAY };
  }
  return null;
}
export function memberMilestones(data, today = calendarDate(), withinDays = 30) {
  const result = [];
  for (const [key, original, emoji, label] of [['birthday', data.birthday, '🎂', 'Birthday'], ['anniversary', data.active === false ? null : data.joinedOn, '🌱', 'CoA anniversary']]) {
    const next = nextOccurrence(original, today);
    if (!next || next.days > withinDays) continue;
    const dayText = next.days === 0 ? 'today! A little celebration?' : next.days === 1 ? 'tomorrow!' : `in ${next.days} days`;
    result.push({ key, ...next, text: `${emoji} ${label} ${dayText}` });
  }
  return result.sort((a, b) => a.days - b.days);
}
