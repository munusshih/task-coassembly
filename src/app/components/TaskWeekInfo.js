"use client";

import { useEffect, useId, useRef, useState } from "react";
import PageGuide from "./PageGuide";
import CloseButton from "./ui/CloseButton";
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
  const isTask = pageKey === "members";
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
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
      <button type="button" className="task-info-asterisk" aria-label={isTask ? "Week information" : `${pageInfo[0]} information`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}><img src="/illustrations/asterisk.svg" alt="" /></button>
      <PageGuide tabKey={pageKey} className="task-header-help" icon="/illustrations/help-hat.svg" iconOnly />
      <dialog ref={dialogRef} id={panelId} className="task-info-drawer" aria-labelledby={`${panelId}-title`} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
      }}>
        <CloseButton className="task-info-close" label={isTask ? "Close task information" : `Close ${pageInfo[0]} information`} onClick={() => setOpen(false)} autoFocus />
        {isTask ? <>
        <section className="task-info-week" aria-label="Quarter and meeting duties">
          <h3>{remainingWeeks} {remainingWeeks === 1 ? "week" : "weeks"} until Q{quarter} ends</h3>
          <p>Our meeting crew for this month:</p>
          <dl>{["time keeper", "facilitator", "notetaker"].map((duty) => (
            <div key={duty}><dt>{assignments[duty] || "Unassigned"}</dt><dd>{duty}</dd></div>
          ))}</dl>
        </section>
        <div className="task-info-introduction">
        <h2 id={`${panelId}-title`}>A little about Tasks</h2>
        <p>Hey! This is where we make a shared plan for the week, see what everyone is working on, and keep useful links close to the work.</p>
        <h3>Make room for the work</h3>
        <p>Start with a task, a project, and an estimate. People shows individual workloads, Projects brings related tasks together, and Links collects the things we’ve shared.</p>
        <h3>Why track time?</h3>
        <p>Work often takes a different amount of time than we expect. Recording that time helps us understand the effort involved, spot overloaded weeks, and make more realistic plans together.</p>
        <p>This isn’t a race. Taking longer is useful information: it can mean the work needs more space, support, or a smaller next step.</p>
        <h3>Reading the numbers</h3>
        <p>Under each person’s name, you’ll see worked time beside the clock, followed by the time allocated to their tasks. Compare the two to get a feel for the week.</p>
        <h3>Share what you finished</h3>
        <p>Add at least one link before checking a task off, so everyone can find the result. Review and Reject live in People view.</p>

        </div>
        </> : <div className="workspace-page-introduction"><h2 id={`${panelId}-title`}>A little about {pageInfo[0]}</h2><p>{pageInfo[1]}</p><p>The menu at the top left takes you to the other workspace pages. The hat beside the asterisk opens a guided tour whenever you need a hand.</p></div>}
      </dialog>
    </div>
  );
}
