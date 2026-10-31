import {durationLabel} from '../time/trackingModel.mjs';
import styles from './ProjectTimeBars.module.css';
export default function ProjectTimeBars({planned,recorded,capacity=null}) {
 const scale=capacity||Math.max(planned,recorded,1);
 return <div className={styles.metrics} aria-label={capacity?'Time against project capacity':'Planned and recorded project time'}>{[{label:'Planned',seconds:planned,tone:'planned'},{label:'Recorded',seconds:recorded,tone:'recorded'}].map(metric=>{
  const percent=Math.round(metric.seconds/scale*100);
  return <div className={styles.metric} key={metric.label}><div className={styles.label}><span>{metric.label}</span><strong>{durationLabel(metric.seconds)}{capacity&&<small> · {percent}% of capacity</small>}</strong></div><div className={styles.track} role="meter" aria-label={metric.label} aria-valuemin={0} aria-valuemax={Math.max(scale,metric.seconds)} aria-valuenow={metric.seconds} aria-valuetext={`${durationLabel(metric.seconds)}${capacity?` of ${durationLabel(capacity)} capacity`:''}`}><span className={styles[metric.tone]} style={{width:`${Math.min(100,percent)}%`}}/></div></div>;
 })}</div>;
}
