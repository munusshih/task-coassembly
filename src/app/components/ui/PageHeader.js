"use client";

import CountBadge from "./CountBadge";

export default function PageHeader({
  title,
  subtitle,
  badge,
  right,
  className = "",
  leftClassName = "",
  rightClassName = "",
}) {
  const rootClasses = ["page-header", className].filter(Boolean).join(" ");
  const leftClasses = ["page-header-left", leftClassName].filter(Boolean).join(" ");
  const rightClasses = ["page-header-right", rightClassName].filter(Boolean).join(" ");

  return (
    <div className={rootClasses}>
      <div className={leftClasses}>
        <div className="page-header-title-row">
          <h2 className="section-title">{title}</h2>
          {badge ? <CountBadge>{badge}</CountBadge> : null}
        </div>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {right ? <div className={rightClasses}>{right}</div> : null}
    </div>
  );
}
