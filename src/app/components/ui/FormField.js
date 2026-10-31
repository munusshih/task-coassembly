export default function FormField({ label, hint, children, className = "" }) {
  const classes = ["workspace-form-field", className].filter(Boolean).join(" ");
  return <label className={classes}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
