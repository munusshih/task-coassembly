import MetadataPill from './MetadataPill';
import { memberMilestones } from '../memberMilestones.mjs';
export default function MemberMilestones({ member, today }) {
  return <div className="member-milestones">{memberMilestones(member.data || {}, today).map(event => <MetadataPill key={event.key} tone={event.key === 'birthday' ? 'date' : 'worked'} className={event.days <= 14 ? 'member-milestone--soon' : ''}><time dateTime={event.date}>{event.text}</time></MetadataPill>)}</div>;
}
