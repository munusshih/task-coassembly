"use client";

import EmptyState from "./ui/EmptyState";
import { SURFACE_TEXTURES } from "./ui/paperTextures";
import SectionBlock from "./ui/SectionBlock";
import TabPage from "./ui/TabPage";

export default function TbdPage({ tabKey }) {
  return (
    <TabPage className="tbd-page" title={tabKey}>
      <SectionBlock className="tbd-section" texture={SURFACE_TEXTURES.placeholder} header={false}>
        <EmptyState inset>This section is under construction. Check back soon.</EmptyState>
      </SectionBlock>
    </TabPage>
  );
}
