"use client";

export default function AddTrigger({
  label,
  onClick,
  icon = "+",
  className = "",
  inset = false,
  type = "button",
}) {
  const classes = ["add-trigger", inset ? "add-trigger--inset" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} onClick={onClick}>
      <span className="add-trigger-icon">{icon}</span>
      <span className="add-trigger-label">{label}</span>
    </button>
  );
}
