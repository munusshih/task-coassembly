"use client";

export default function IconButton({
  type = "button",
  variant,
  className = "",
  ...props
}) {
  const variantClass = variant ? `icon-btn--${variant}` : "";
  const classes = ["icon-btn", variantClass, className].filter(Boolean).join(" ");

  return <button type={type} className={classes} {...props} />;
}
