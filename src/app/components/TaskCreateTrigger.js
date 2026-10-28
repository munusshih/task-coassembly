export default function TaskCreateTrigger({ onClick }) {
  return <button type="button" className="notepad-add-trigger" onClick={onClick}><span className="notepad-add-plus">+</span><span className="notepad-add-placeholder">New task…</span></button>;
}
