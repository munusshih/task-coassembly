"use client";

export default function Surface({ as = "div", className = "", children }) {
  const Component = as;
  return <Component className={["surface-body", className].filter(Boolean).join(" ")}>{children}</Component>;
}
