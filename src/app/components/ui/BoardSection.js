"use client";

import SectionBlock from "./SectionBlock";

export default function BoardSection({ title, badge, children, className = "", headerExtra }) {
  const classes = ["board-section", className].filter(Boolean).join(" ");

  return (
    <SectionBlock
      title={title}
      badge={badge}
      actions={headerExtra}
      className={classes}
      bodyClassName="board-section-body"
    >
      {children}
    </SectionBlock>
  );
}
