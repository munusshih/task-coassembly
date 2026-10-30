import {projectWorkTone} from '../memberRoleMetrics.mjs';
/** A shared percentage chart with a text equivalent for every sector. */
export default function AllocationRing({allocations,formatTime}) {
 const total=allocations.reduce((sum,item)=>sum+Math.max(0,Number(item.units)||0),0);
 if(!total)return null;
 let offset=0;const circumference=2*Math.PI*40;
 return <div className="allocation-ring"><svg viewBox="0 0 110 110" role="img" aria-label="Project allocation percentages"><title>Project allocation percentages</title>{allocations.filter(item=>item.units>0).map(item=>{const span=item.units/total,circle=<circle key={item.id} cx="55" cy="55" r="40" fill="none" stroke={`var(--workspace-${projectWorkTone(item.kind)})`} strokeWidth="15" strokeDasharray={`${Math.max(0,span*circumference-1.5)} ${circumference}`} strokeDashoffset={-offset*circumference} transform="rotate(-90 55 55)"><title>{item.name}: {Math.round(span*100)}%</title></circle>;offset+=span;return circle;})}<text x="55" y="58" textAnchor="middle">100%</text><text x="55" y="70" textAnchor="middle" className="allocation-ring-caption">allocated</text></svg><ul>{allocations.filter(item=>item.units>0).map(item=><li key={item.id}><span className="allocation-ring-key" style={{background:`var(--workspace-${projectWorkTone(item.kind)})`}}/><span>{item.name}</span><strong>{Math.round(item.units/total*100)}%</strong><small>{formatTime(item.units)}</small></li>)}</ul></div>;
}
