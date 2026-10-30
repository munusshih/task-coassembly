"use client";

import HeadingCount from "./HeadingCount";

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
}) {
  const TitleTag = titleTag;
  const classes = [
    "section-block",
    "card-section",
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
          <HeadingCount as={titleTag} title={title} count={badge} className="section-block-title-row" titleClassName="section-block-title card-section-title"/>
          {actions ? <div className="section-block-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClasses}>{children}</div>
    </section>
  );
}
