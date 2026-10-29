"use client";

export default function SelectField({ className = "", children, icon, chevron = false, ...props }) {
  const classes = ["field-select", className].filter(Boolean).join(" ");
  const select = (
    <select className={classes} {...props}>
      {children}
    </select>
  );
  return icon || chevron ? <span className={`field-select-wrap${chevron ? ' field-select-wrap--chevron' : ''}`}>{icon && <span className="field-select-icon" aria-hidden="true">{icon}</span>}{select}{chevron && <svg className="field-select-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>}</span> : select;
}
