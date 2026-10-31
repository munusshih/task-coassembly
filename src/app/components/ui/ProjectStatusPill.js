import MetadataPill from './MetadataPill';
import {PROJECT_STATES} from '../projectStates.mjs';
export const PROJECT_STATE_DESIGNS=Object.fromEntries(PROJECT_STATES.map(state=>[state.id,state]));
export default function ProjectStatusPill({ status }) {
  if (!status) return null;
  const design = PROJECT_STATE_DESIGNS[status] || PROJECT_STATE_DESIGNS.Scheduled;
  return <MetadataPill tone={design.tone} className="project-status-pill"><img src={`/illustrations/${design.icon}.svg`} alt=""/>{status}</MetadataPill>;
}
