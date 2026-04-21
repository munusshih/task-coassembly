"use client";

import SectionBlock from "./SectionBlock";

export default function BoardSection({ title, badge, children, className = "", headerExtra }) {
  const classes = ["board-section", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className="card-section-head">
        <span className="card-section-title">{title}</span>
        <div className="board-section-meta">
          {badge ? <CountBadge>{badge}</CountBadge> : null}
          {headerExtra}
        </div>
      </div>
      {children}
    </SectionBlock>
  );
}
