"use client";

import EmptyState from "./ui/EmptyState";
import PageHeader from "./ui/PageHeader";

export default function TbdPage({ tabKey }) {
  return (
    <div className="tbd-page">
      <PageHeader title={tabKey} />
      <div className="panel empty-state-card">
        <EmptyState inset>This section is under construction. Check back soon.</EmptyState>
      </div>
    </div>
  );
}
