"use client";

export default function EntityCard({
  as = "article",
  children,
  className = "",
  variant = "surface",
  interactive = false,
}) {
  const Component = as;
  const classes = [
    "entity-card",
    `entity-card--${variant}`,
    interactive ? "entity-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes}>{children}</Component>;
}
