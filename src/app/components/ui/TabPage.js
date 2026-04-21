"use client";

import PageHeader from "./PageHeader";

export default function TabPage({
  title,
  subtitle,
  badge,
  right,
  header,
  className = "",
  contentClassName = "",
  headerClassName = "",
  children,
}) {
  const rootClasses = ["tab-page", className].filter(Boolean).join(" ");
  const bodyClasses = ["tab-page-content", contentClassName].filter(Boolean).join(" ");

  return (
    <section className={rootClasses}>
      {header === null
        ? null
        : (header || (
          <PageHeader
            title={title}
            subtitle={subtitle}
            badge={badge}
            right={right}
            className={headerClassName}
          />
        ))}
      <div className={bodyClasses}>{children}</div>
    </section>
  );
}
