"use client";

import EmptyState from "./ui/EmptyState";
import TabPage from "./ui/TabPage";

export default function TbdPage({ tabKey }) {
  return (
    <TabPage className="tbd-page" title={tabKey}>
      <div className="card-section">
        <EmptyState inset>This section is under construction. Check back soon.</EmptyState>
      </div>
    </TabPage>
  );
}
