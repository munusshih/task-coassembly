"use client";

import ControlSurface from "./ui/ControlSurface";

export default function Button({
  type = "button",
  variant = "primary",
  size,
  className = "",
  style,
  ...props
}) {
  const variantClass = variant ? `btn--${variant}` : "";
  const sizeClass = size ? `btn--${size}` : "";
  const classes = ["btn", variantClass, sizeClass, className].filter(Boolean).join(" ");

  return <ControlSurface tone={variant==='primary'?'solid':variant==='secondary'?'outlined':'quiet'} type={type} className={classes} style={{borderRadius:"var(--radius-button)",...style}} {...props} />;
}
