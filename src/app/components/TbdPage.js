"use client";

import EmptyState from "./ui/EmptyState";
import SectionBlock from "./ui/SectionBlock";
import TabPage from "./ui/TabPage";

export default function TbdPage({ tabKey }) {
  return (
    <TabPage className="tbd-page" title={{ homepage: "Homepage", settings: "Settings" }[tabKey] || tabKey}>
      <SectionBlock className="tbd-section" header={false}>
        <EmptyState inset>This section is under construction. Check back soon.</EmptyState>
      </SectionBlock>
    </TabPage>
  );
}
