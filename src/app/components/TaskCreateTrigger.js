export default function TaskCreateTrigger({ onClick, label = "New task…" }) {
  return <button type="button" className="notepad-add-trigger" onClick={onClick}><span className="notepad-add-plus">+</span><span className="notepad-add-placeholder">{label}</span></button>;
}
