export default function MemberEditButton({ name, onClick }) {
  return <button type="button" className="member-edit-button" onClick={onClick} aria-label={`Edit ${name}`} title={`Edit ${name}`}><img src="/illustrations/edit-hammer.svg" alt="" /></button>;
}
