"use client";
import AllocationClock from './ui/AllocationClock';
export default function ProjectAllocationClock({ highlightedProject, ...props }) {
  return <AllocationClock {...props} highlightedId={highlightedProject} />;
}
