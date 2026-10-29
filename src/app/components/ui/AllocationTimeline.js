import TaskClockIcon from './TaskClockIcon';

export default function AllocationTimeline({ weeks, formatTime, weekLabel }) {
  const max = Math.max(1, ...weeks.map(week => week.units));
  const total = weeks.reduce((sum, week) => sum + week.units, 0);
  return <figure className="member-allocation-timeline" aria-label="Planned time used to calculate work mix">
    <figcaption><TaskClockIcon /><span>{formatTime(total)} allocated</span></figcaption>
    <div className="member-allocation-timeline-weeks">{[...weeks].reverse().map(week => <div className="member-allocation-timeline-week" key={week.key} role="img" aria-label={`${weekLabel(week.key)}: ${formatTime(week.units)} allocated`} title={`${weekLabel(week.key)} · ${formatTime(week.units)}`}><span className="member-allocation-timeline-track"><span style={{ height: `${week.units / max * 100}%` }} /></span><small>{week.key.slice(5).replace('-', '/')}</small></div>)}</div>
  </figure>;
}
