"use client";

import IconButton from "../IconButton";
import CrossIcon from "./CrossIcon";
import InputField from "./InputField";
import SearchIcon from "./SearchIcon";
import styles from "./SearchField.module.css";

export default function SearchField({
  value,
  onChange,
  onClear,
  placeholder = "Search…",
  className = "",
  inputClassName = "",
  clearTitle = "Clear search",
  ariaLabel = "Search",
}) {
  const wrapperClasses = ["search-field", styles.field, className].filter(Boolean).join(" ");
  const classes = ["search-input", styles.input, inputClassName].filter(Boolean).join(" ");
  const hasValue = Boolean(value);

  return (
    <div className={wrapperClasses}>
      <SearchIcon />
      <InputField
        type="text"
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={classes}
      />
      {hasValue ? (
        <IconButton type="button" className={`search-clear ${styles.clear}`} onClick={onClear} title={clearTitle}>
          <CrossIcon />
        </IconButton>
      ) : null}
    </div>
  );
}
