"use client";

import { resolvePaperTexture } from "./paperTextures";

export default function EntityCard({
  as = "article",
  children,
  className = "",
  variant = "surface",
  texture,
  interactive = false,
}) {
  const Component = as;
  const resolvedTexture = texture ? resolvePaperTexture(texture) : null;
  const classes = [
    "entity-card",
    `entity-card--${variant}`,
    interactive ? "entity-card--interactive" : "",
    resolvedTexture ? "paper-surface" : "",
    resolvedTexture ? `paper-surface--${resolvedTexture}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes}>{children}</Component>;
}
