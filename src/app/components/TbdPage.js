"use client";

export default function TbdPage({ tabKey }) {
  return (
    <div className="tbd-page">
      <h2 className="section-title">{tabKey}</h2>
      <div className="panel empty-state-card">
        <p>This section is under construction. Check back soon.</p>
      </div>
    </div>
  );
}
