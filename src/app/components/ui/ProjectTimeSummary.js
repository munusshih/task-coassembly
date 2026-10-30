import {durationLabel} from '../time/trackingModel.mjs';
export default function ProjectTimeSummary({progress,compact=false}) {
 const percent=progress.allocatedSeconds>0?`${progress.percent}%`:'No plan';
 if(compact)return <span className="project-time-summary project-time-summary--compact">{progress.allocatedSeconds>0?`${percent} logged · ${durationLabel(progress.allocatedSeconds)} planned`:'No time planned'}</span>;
 return <span className="project-time-summary"><span><strong>{progress.capacitySeconds==null?'Not set':durationLabel(progress.capacitySeconds)}</strong><small>capacity</small></span><span><strong>{durationLabel(progress.allocatedSeconds)}</strong><small>planned</small></span><span><strong>{percent}</strong><small>logged / planned</small></span></span>;
}
