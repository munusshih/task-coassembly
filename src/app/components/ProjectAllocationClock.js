"use client";

import { useId } from "react";

const letter = (index) => { let value = index + 1, label = ""; while (value > 0) { value--; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); } return `${label}.`; };

const point = (angle, radius) => [900 + Math.sin(angle) * radius, 775 - Math.cos(angle) * radius];

export default function ProjectAllocationClock({ allocations, formatTime, highlightedProject, onHighlight }) {
  const id = useId().replace(/:/g, "");
  const allocated = allocations.filter((project) => project.units > 0);
  const total = allocated.reduce((sum, project) => sum + project.units, 0);
  let cursor = 0;
  return (
    <figure className="project-allocation-clock" aria-label={`Project time allocation: ${total ? formatTime(total) : "0m"} total`}>
      <svg className="allocation-illustration" viewBox="-65 -65 1779 2231" role="group" aria-labelledby={`${id}-title`} onPointerLeave={() => onHighlight(null)}>
        <title id={`${id}-title`}>Project allocation clock. Focus or hover a slice to highlight its project.</title>
        <image href="/illustrations/allocation-clock-person.svg" width="1649" height="2101" onPointerEnter={() => onHighlight(null)} />
        {allocated.map((project, index) => {
          const start = cursor;
          cursor += project.units / total * Math.PI * 2;
          const end = cursor;
          const a = point(start, 610), b = point(end, 610), label = point((start + end) / 2, project.units / total < .035 ? index % 2 ? 540 : 430 : 475);
          const path = total === project.units ? null : `M900 775 L${a.join(" ")} A610 610 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.join(" ")} Z`;
          const dimmed = highlightedProject && highlightedProject !== project.id;
          const active = highlightedProject === project.id;
          const highlight = () => onHighlight(project.id);
          return <g key={project.id} className="allocation-slice" role="button" tabIndex={0}
            aria-label={`${project.name}: ${formatTime(project.units)}, ${Math.round(project.units / total * 100)}%`}
            aria-pressed={active} onPointerEnter={highlight} onFocus={highlight} onBlur={() => onHighlight(null)}
            onClick={() => onHighlight(active ? null : project.id)} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onHighlight(active ? null : project.id); }
              if (event.key === "Escape") onHighlight(null);
            }}>
            {path ? <path d={path} fill="#fff" fillOpacity={dimmed ? .78 : active ? .16 : 0} stroke="#fff" strokeWidth="4" /> : <circle cx="900" cy="775" r="610" fill="#fff" fillOpacity={active ? .16 : 0} />}
            {<text pointerEvents="none" opacity={dimmed ? .25 : 1} x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="central" fontSize="58" fontWeight="700" fill="#fff">{letter(index)}</text>}
          </g>;
        })}
      </svg>
      <figcaption>
        <h2 className="sr-only">This week’s allocation</h2>
        {total ? <ol onPointerLeave={() => onHighlight(null)}>{allocated.map((project, index) => {
          const share = project.units / total * 100;
          const active = highlightedProject === project.id;
          return <li key={project.id} className={highlightedProject ? active ? "allocation-row--active" : "allocation-row--dimmed" : ""}>
            <button type="button" className="allocation-row" onPointerEnter={() => onHighlight(project.id)} onFocus={() => onHighlight(project.id)} onBlur={() => onHighlight(null)} onClick={() => onHighlight(active ? null : project.id)} aria-pressed={active}>
              <span className="allocation-key">{letter(index)}</span>
              <span className="allocation-project-name">{project.name}</span>
              <span className="allocation-hours">{active ? `${Math.round(share)}%` : formatTime(project.units)}</span>
              <span className="allocation-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
            </button>
          </li>;
        })}</ol> : <p>Add planned time to a task to start the clock.</p>}
      </figcaption>
      <p className="allocation-total">{total ? formatTime(total) : "0m"} allocated</p>
    </figure>
  );
}
