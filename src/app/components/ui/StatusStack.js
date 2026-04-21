"use client";

import { Children } from "react";

export default function StatusStack({ children, className = "", ariaLive = "polite" }) {
  if (Children.count(children) === 0) return null;
  const classes = ["status-stack", className].filter(Boolean).join(" ");
  return (
    <div className={classes} aria-live={ariaLive}>
      {children}
    </div>
  );
}
