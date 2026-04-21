"use client";

export default function TextareaField({ className = "", ...props }) {
  const classes = ["field-textarea", className].filter(Boolean).join(" ");
  return <textarea className={classes} {...props} />;
}
