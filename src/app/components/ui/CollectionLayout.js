"use client";

export default function CollectionLayout({
  as = "div",
  children,
  variant = "grid",
  className = "",
}) {
  const Component = as;
  const classes = ["collection-layout", `collection-layout--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes}>{children}</Component>;
}
