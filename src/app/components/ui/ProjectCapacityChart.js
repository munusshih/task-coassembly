import {durationLabel} from '../time/trackingModel.mjs';
import ProjectTimeBars from './ProjectTimeBars';
import styles from './ProjectCapacityChart.module.css';

export default function ProjectCapacityChart({progress}) {
 return <section className={styles.card} aria-label="Project time compared with capacity">
  <header className={styles.header}>
   <div><h3>Time against capacity</h3><p>{progress.capacitySeconds?'Planned and logged time compared with the project limit.':'Set a project hour limit to compare time with capacity.'}</p></div>
   <span className={styles.capacity}>{progress.capacitySeconds?durationLabel(progress.capacitySeconds):'No limit set'}</span>
  </header>
  <ProjectTimeBars planned={progress.allocatedSeconds} recorded={progress.loggedSeconds} capacity={progress.capacitySeconds}/>

 </section>;
}
