export default function FormField({ label, hint, children }) {
  return <label className="workspace-form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
