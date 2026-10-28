"use client";

import { useId } from "react";

const letter = (index) => { let value = index + 1, label = ""; while (value > 0) { value--; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); } return `${label}.`; };

const CLOCKS = {
  project: { src: '/illustrations/allocation-clock-person.svg', width: 1649, height: 2101, viewBox: '-65 -65 1779 2231', cx: 900, cy: 775, radius: 610, labelRadius: 475 },
  member: { src: '/illustrations/allocation-clock-team.svg', width: 2252, height: 1687, viewBox: '-40 -40 2332 1767', cx: 1138, cy: 540, radius: 430, labelRadius: 315 },
};

export default function AllocationClock({ allocations, formatTime, highlightedId, onHighlight, variant = 'project', subject = 'Project', periodLabel = 'This week’s allocation' }) {
  const clock = CLOCKS[variant] || CLOCKS.project;
  const point = (angle, radius) => [clock.cx + Math.sin(angle) * radius, clock.cy - Math.cos(angle) * radius];
  const id = useId().replace(/:/g, "");
  const allocated = allocations.filter((project) => project.units > 0);
  const total = allocated.reduce((sum, project) => sum + project.units, 0);
  let cursor = 0;
  return (
    <figure className={`project-allocation-clock allocation-clock--${variant}`} aria-label={`${subject} time allocation: ${total ? formatTime(total) : "0m"} total`}>
      <svg className="allocation-illustration" viewBox={clock.viewBox} role="group" aria-labelledby={`${id}-title`} onPointerLeave={() => onHighlight(null)}>
        <title id={`${id}-title`}>{subject} allocation clock. Focus or hover a slice to highlight its {subject.toLowerCase()}.</title>
        <image href={clock.src} width={clock.width} height={clock.height} onPointerEnter={() => onHighlight(null)} />
        {allocated.map((project, index) => {
          const start = cursor;
          cursor += project.units / total * Math.PI * 2;
          const end = cursor;
          const a = point(start, clock.radius), b = point(end, clock.radius), label = point((start + end) / 2, project.units / total < .035 ? index % 2 ? clock.labelRadius * 1.1 : clock.labelRadius * .85 : clock.labelRadius);
          const path = total === project.units ? null : `M${clock.cx} ${clock.cy} L${a.join(" ")} A${clock.radius} ${clock.radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.join(" ")} Z`;
          const dimmed = highlightedId && highlightedId !== project.id;
          const active = highlightedId === project.id;
          const highlight = () => onHighlight(project.id);
          return <g key={project.id} className="allocation-slice" role="button" tabIndex={0}
            aria-label={`${project.name}: ${formatTime(project.units)}, ${Math.round(project.units / total * 100)}%`}
            aria-pressed={active} onPointerEnter={highlight} onFocus={highlight} onBlur={() => onHighlight(null)}
            onClick={() => onHighlight(active ? null : project.id)} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onHighlight(active ? null : project.id); }
              if (event.key === "Escape") onHighlight(null);
            }}>
            {path ? <path d={path} fill="#fff" fillOpacity={dimmed ? .78 : active ? .16 : 0} stroke="#fff" strokeWidth="4" /> : <circle cx={clock.cx} cy={clock.cy} r={clock.radius} fill="#fff" fillOpacity={active ? .16 : 0} />}
            {<text pointerEvents="none" opacity={dimmed ? .25 : 1} x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="central" fontSize={variant === "member" ? 48 : 58} fontWeight="700" fill="#fff">{letter(index)}</text>}
          </g>;
        })}
      </svg>
      <figcaption>
        <h2 className="sr-only">{periodLabel}</h2>
        {total ? <ol onPointerLeave={() => onHighlight(null)}>{allocated.map((project, index) => {
          const share = project.units / total * 100;
          const active = highlightedId === project.id;
          return <li key={project.id} className={highlightedId ? active ? "allocation-row--active" : "allocation-row--dimmed" : ""}>
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
