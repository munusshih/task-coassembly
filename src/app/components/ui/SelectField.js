"use client";

export default function SelectField({ className = "", children, icon, ...props }) {
  const classes = ["field-select", className].filter(Boolean).join(" ");
  const select = (
    <select className={classes} {...props}>
      {children}
    </select>
  );
  return icon ? <span className="field-select-wrap"><span className="field-select-icon" aria-hidden="true">{icon}</span>{select}</span> : select;
}
