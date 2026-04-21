"use client";

import InputField from "./InputField";

export default function SearchField({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  className = "",
  inputClassName = "",
  clearTitle = "Clear search",
}) {
  const wrapperClasses = ["search-field", className].filter(Boolean).join(" ");
  const classes = ["search-input", inputClassName].filter(Boolean).join(" ");
  const hasValue = Boolean(value);

  return (
    <div className={wrapperClasses}>
      <InputField
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={classes}
      />
      {hasValue ? (
        <button type="button" className="search-clear" onClick={onClear} title={clearTitle}>
          ×
        </button>
      ) : null}
    </div>
  );
}
