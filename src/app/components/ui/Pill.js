"use client";

export default function Pill({ children, className = "", size }) {
  const sizeClass = size ? `chip--${size}` : "";
  const classes = ["chip", sizeClass, className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}
