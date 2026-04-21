"use client";

export default function PageControls({ children, className = "", compact = false }) {
  const classes = ["page-controls", compact ? "page-controls--compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
