import { memberMilestones } from '../memberMilestones.mjs';
export default function MemberMilestones({ member, today }) {
  const events = memberMilestones(member.data || {}, today);
  if (!events.length) return null;
  return <div className="member-milestones">{events.map(event => <time key={event.key} dateTime={event.date}>{event.text}</time>)}</div>;
}
