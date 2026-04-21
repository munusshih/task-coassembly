"use client";

import CountBadge from "./CountBadge";
import { resolvePaperTexture } from "./paperTextures";

export default function SectionBlock({
  title,
  badge,
  actions,
  children,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  titleTag = "h3",
  header = true,
  texture,
}) {
  const TitleTag = titleTag;
  const resolvedTexture = texture ? resolvePaperTexture(texture) : null;
  const classes = [
    "section-block",
    "card-section",
    resolvedTexture ? "paper-surface" : "",
    resolvedTexture ? `paper-surface--${resolvedTexture}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const headerClasses = ["section-block-head", "card-section-head", headerClassName]
    .filter(Boolean)
    .join(" ");

  const bodyClasses = ["section-block-body", bodyClassName].filter(Boolean).join(" ");

  const showHeader = header !== false && (title || badge || actions);

  return (
    <section className={classes}>
      {showHeader ? (
        <div className={headerClasses}>
          <div className="section-block-title-row">
            {title ? <TitleTag className="section-block-title card-section-title">{title}</TitleTag> : null}
            {badge ? <CountBadge>{badge}</CountBadge> : null}
          </div>
          {actions ? <div className="section-block-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClasses}>{children}</div>
    </section>
  );
}
