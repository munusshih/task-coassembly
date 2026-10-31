import { tenureText } from '../memberMilestones.mjs';

export default function MemberTenure({ member, today }) {
  const data = member.data || {};
  const description = tenureText(data, today);
  if (description === 'Not set') return null;
  return <p className="member-tenure" title={description} aria-label={description}>
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21v-9M12 15C5 15 3 11 3 5c6 0 9 3 9 10ZM12 12c0-6 3-9 9-9 0 6-3 9-9 9Z" /></svg>
    <span>{tenureText(data, today, { compact: true })}</span>
  </p>;
}
