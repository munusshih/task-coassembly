"use client";

export default function InputField({ className = "", ...props }) {
  const classes = ["field-input", className].filter(Boolean).join(" ");
  return <input className={classes} {...props} />;
}
