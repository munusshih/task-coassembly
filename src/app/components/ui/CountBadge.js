"use client";

export default function CountBadge({ children, className = "" }) {
  const classes = ["count-badge", className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}
