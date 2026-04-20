"use client";

export default function Button({
  type = "button",
  variant = "primary",
  size,
  className = "",
  ...props
}) {
  const variantClass = variant ? `btn--${variant}` : "";
  const sizeClass = size ? `btn--${size}` : "";
  const classes = ["btn", variantClass, sizeClass, className].filter(Boolean).join(" ");

  return <button type={type} className={classes} {...props} />;
}
