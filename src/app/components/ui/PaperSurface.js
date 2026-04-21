"use client";

import { resolvePaperTexture } from "./paperTextures";

export default function PaperSurface({
  as = "div",
  texture = "lined",
  className = "",
  children,
}) {
  const Component = as;
  const resolvedTexture = resolvePaperTexture(texture);
  const classes = ["paper-surface", `paper-surface--${resolvedTexture}`, className]
    .filter(Boolean)
    .join(" ");

  return <Component className={classes}>{children}</Component>;
}
