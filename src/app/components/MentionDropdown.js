"use client";

export default function MentionDropdown({ suggestions, selected, onSelect }) {
  return (
    <div className="mention-dropdown">
      <div className="mention-list">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            className={`mention-item ${index === selected ? "is-selected" : ""}`}
            onClick={() => onSelect(suggestion)}
          >
            <span className={`mention-type mention-type--${suggestion.type}`}>
              {suggestion.type === "member" ? "👤" : "📋"}
            </span>
            {suggestion.label}
          </div>
        ))}
      </div>
    </div>
  );
}
