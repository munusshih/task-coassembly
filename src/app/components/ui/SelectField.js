"use client";

export default function SelectField({ className = "", children, icon, chevron = true, tone, style, ...props }) {
  const classes = ["field-select", tone==='inverse'?'field-select--inverse':'', className].filter(Boolean).join(" ");
  const select = (
    <select className={classes} style={{borderRadius:"var(--radius-field)",...style}} {...props}>
      {children}
    </select>
  );
  return icon || chevron ? <span className={`field-select-wrap${chevron ? ' field-select-wrap--chevron' : ''}${tone==='inverse'?' field-select-wrap--inverse':''}`}>{icon && <span className="field-select-icon" aria-hidden="true">{icon}</span>}{select}{chevron && <svg className="field-select-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>}</span> : select;
}
