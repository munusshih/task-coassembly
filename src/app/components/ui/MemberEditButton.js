import EditButton from "./EditButton";
export default function MemberEditButton({ name, onClick }) {
  return <EditButton className="member-edit-button" label={`Edit ${name}`} onClick={onClick} />;
}
