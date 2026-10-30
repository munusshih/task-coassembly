"use client";

export default function InputField({ className = "", style, ...props }) {
  const classes = ["field-input", className].filter(Boolean).join(" ");
  return <input className={classes} style={{borderRadius:"var(--radius-field)",...style}} {...props} />;
}
