"use client";

import CountBadge from "./CountBadge";
import WorkspacePageHero from "./WorkspacePageHero";
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
    <WorkspacePageHero title={title} className={rootClasses}>
      <div className={rightClasses}>{badge ? <CountBadge>{badge}</CountBadge> : null}{subtitle ? <p className="section-subtitle">{subtitle}</p> : null}{right}</div>
    </WorkspacePageHero>
  );
}
