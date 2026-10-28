"use client";

export default function ViewToggle({
  value,
  options,
  onChange,
  className = "",
  ariaLabel = "View options",
}) {
  const classes = ["view-toggle-group", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        const buttonClass = "view-toggle-btn" + (active ? " view-toggle-btn--active" : "");
        return (
          <button
            key={option.value}
            type="button"
            className={buttonClass}
            onClick={() => onChange(option.value)}
            title={option.title || option.label || option.value}
            aria-pressed={active}
          >
            {option.icon ? <span className="view-toggle-icon">{option.icon}</span> : null}
            <span className="view-toggle-label">{option.label || option.title || option.value}</span>
          </button>
        );
      })}
    </div>
  );
}
