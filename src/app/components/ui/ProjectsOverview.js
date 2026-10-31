import {projectTimeProgress} from '../projectProgress.mjs';
import {durationLabel} from '../time/trackingModel.mjs';
import ProjectTimeBars from './ProjectTimeBars';
import Button from '../Button';
import styles from './ProjectsOverview.module.css';
export default function ProjectsOverview({projects,tasks,closedCount,showClosed,onToggle}) {
 const totals=projects.reduce((sum,project)=>{const time=projectTimeProgress(project.id,tasks);return {planned:sum.planned+time.allocatedSeconds,recorded:sum.recorded+time.loggedSeconds};},{planned:0,recorded:0});
 return <section className={styles.overview} aria-label="Projects overview"><div className={styles.summary}><div><strong>{projects.length}</strong><span>{showClosed?'All projects':'Active projects'}</span></div><div><strong>{durationLabel(totals.planned)}</strong><span>Planned</span></div><div><strong>{durationLabel(totals.recorded)}</strong><span>Recorded</span></div>{closedCount>0&&<Button variant="ghost" aria-pressed={showClosed} onClick={onToggle}>{showClosed?'Hide closed projects':`Show ${closedCount} closed projects`}</Button>}</div><div className={styles.chart}><ProjectTimeBars planned={totals.planned} recorded={totals.recorded}/></div></section>;
}
