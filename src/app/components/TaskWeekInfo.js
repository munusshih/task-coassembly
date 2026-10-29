"use client";

import { useState } from "react";
import PageGuide from "./PageGuide";
import usePageRationales from "./usePageRationales";
import { useId } from "react";
import RationaleBoard from "./RationaleBoard";
import { isWorkerOwner } from "../../authAccess";

const DUTIES = ["facilitator", "notetaker", "time keeper"];

export default function TaskWeekInfo({ week = new Date().toISOString().slice(0, 10), members = [], pageKey = "members" }) {
  const pageInfo = {
    resources: ["Resource", "Our shared shelf for useful links, references, and tools. Browse by category or date to find something useful. Each folder keeps a locally saved preview alongside its contributor and submission date."],
    projects: ["Projects", "Keep the team’s projects, people, and plans together. Open a project to see its details and update the work as it develops."],
    finance: ["Finance", "A shared view of project budgets and team finances. Use the filters to explore a period or compare how work is allocated."],
    payouts: ["Requests", "Create and follow up on payment requests here. Requests live under Finance so the money side of the work stays together."],
    backlog: ["Wishes", "Keep possibilities and future work here until there’s room to plan them together."],
    meetingNotes: ["Notes", "A shared memory of our meetings. Find a conversation, revisit a decision, or add the next set of notes."],
    memberDirectory: ["Members", "Meet the people behind the work and keep team information up to date. Explore people by role, weekly workload, or overall contributions."],
    homepage: ["Homepage", "Our shared starting point is coming soon."],
    settings: ["Settings", "Workspace settings are coming soon."],
  }[pageKey] || ["Tasks", "Plan the week together."];
  const {notes,allNotes,loaded,error}=usePageRationales(pageKey,pageInfo);
  const countId=useId();
  const isTask = pageKey === "members";
  const [open, setOpen] = useState(false);
  const [year, month, day] = week.split("-").map(Number);
  const quarter = Math.ceil(month / 3);
  const remainingWeeks = Math.ceil((Date.UTC(year, quarter * 3, 1) - Date.UTC(year, month - 1, day)) / (7 * 86400000));
  const monthKey = week.slice(0, 7);
  const assignments = {};
  // Match the monthly rotation and explicit overrides used by meeting notes.
  [...members].filter((member) => isWorkerOwner(member.data)).sort((a, b) =>
    String(a.data.name || a.id).toLowerCase().localeCompare(String(b.data.name || b.id).toLowerCase())
  ).forEach((member, index) => {
    const raw = String(member.data.meetingRoles?.[monthKey] || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
    const normalized = raw === "timekeeper" ? "time keeper" : raw === "note taker" ? "notetaker" : raw;
    const duty = DUTIES.includes(normalized) ? normalized : DUTIES[(year * 12 + month - 1 + index) % 3];
    if (!assignments[duty]) assignments[duty] = member.data.name || "Unnamed";
  });

  return (
    <div className="task-week-info">
      <button type="button" className="task-info-asterisk" aria-label={isTask ? "Week information" : `${pageInfo[0]} information`} aria-expanded={open} aria-describedby={countId} onClick={() => setOpen((value) => !value)}><img src="/illustrations/asterisk.svg" alt="" /><span className="task-info-count" id={countId} aria-label={`${notes.length} shared notes`}>{notes.length}</span></button>
      <PageGuide tabKey={pageKey} className="task-header-help" icon="/illustrations/help-hat.svg" iconOnly />
      {open && <RationaleBoard allNotes={allNotes} notes={notes} loaded={loaded} loadError={error} pageKey={pageKey} pageInfo={pageInfo} onClose={() => setOpen(false)} context={isTask ? <section className="rationale-week"><span className="rationale-eyebrow">This week</span><h3>{remainingWeeks} {remainingWeeks === 1 ? "week" : "weeks"} until Q{quarter} ends</h3><p>Our meeting crew this month</p><dl>{["time keeper", "facilitator", "notetaker"].map(duty => <div key={duty}><dt>{assignments[duty] || "Unassigned"}</dt><dd>{duty}</dd></div>)}</dl></section> : null} />}

    </div>
  );
}
