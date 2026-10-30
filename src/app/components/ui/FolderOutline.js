import { useId } from 'react';
const shape = 'M2 24 Q2 16 10 16 L17 5 Q19 2 25 2 H73 Q77 2 81 6 L89 14 H250 Q258 14 258 22 V210 Q258 218 250 218 H10 Q2 218 2 210 Z';
/** Folder silhouette shared by Resource and Projects; optional vertical time progress. */
export default function FolderOutline({className='',fill='none',progress,bands}) {
 const clip = useId();
 return <svg className={`resource-folder-outline ${className}`} viewBox="0 0 260 220" preserveAspectRatio="none" aria-hidden="true">
  <defs><pattern id={`${clip}-total`} width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="var(--ink)"/></pattern><pattern id={`${clip}-allocated`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke="var(--ink)" strokeWidth=".7"/></pattern><pattern id={`${clip}-logged`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0H8M0 0V8" stroke="var(--ink)" strokeWidth=".8"/></pattern><clipPath id={clip}><path d={shape}/></clipPath></defs>
  <path d={shape} fill={fill}/>
  {progress != null && <rect x="0" y={220 * (1-progress/100)} width="260" height={220*progress/100} fill="var(--folder-progress)" clipPath={`url(#${clip})`}/>}
  {bands&&<g clipPath={`url(#${clip})`}>{bands.map((value,index)=><rect key={index} x={index*260/3} y={220*(1-value/100)} width={260/3} height={220*value/100} fill={`url(#${clip}-${['total','allocated','logged'][index]})`} opacity=".3"/>)}</g>}
  <path d={shape} fill="none" stroke="var(--ink)" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
 </svg>;
}
