"use client";

import ControlSurface from "./ui/ControlSurface";

export default function IconButton({
  type = "button",
  variant,
  className = "",
  ...props
}) {
  const variantClass = variant ? `icon-btn--${variant}` : "";
  const classes = ["icon-btn", variantClass, className].filter(Boolean).join(" ");

  return <ControlSurface type={type} className={classes} {...props} />;
}
