"use client";

import AddTrigger from "./AddTrigger";

export function InlineCreateRow({ children, className = "" }) {
  const classes = ["create-row", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}

export default function CreateBar({
  open,
  onOpen,
  label,
  icon = "+",
  inset = false,
  triggerClassName = "",
  rowClassName = "",
  children,
}) {
  if (open) {
    return <InlineCreateRow className={rowClassName}>{children}</InlineCreateRow>;
  }

  return (
    <AddTrigger
      label={label}
      icon={icon}
      inset={inset}
      className={triggerClassName}
      onClick={onOpen}
    />
  );
}
