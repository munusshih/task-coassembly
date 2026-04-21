"use client";

export default function EmptyState({ children, className = "", inset = false }) {
  const classes = ["empty-state", inset ? "empty-state--inset" : "", className]
    .filter(Boolean)
    .join(" ");
  return <p className={classes}>{children}</p>;
}
