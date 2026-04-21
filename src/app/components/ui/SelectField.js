"use client";

export default function SelectField({ className = "", children, ...props }) {
  const classes = ["field-select", className].filter(Boolean).join(" ");
  return (
    <select className={classes} {...props}>
      {children}
    </select>
  );
}
