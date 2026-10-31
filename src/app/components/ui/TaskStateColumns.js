import {taskReviewColumns} from '../taskReviewColumns.mjs';
import HeadingCount from './HeadingCount';
import styles from './TaskStateColumns.module.css';
export default function TaskStateColumns({tasks,renderTask}) {
 return <div className={styles.columns}>{taskReviewColumns(tasks).map(column=><section className={styles.column} key={column.id} aria-label={column.title}><HeadingCount as="h5" title={column.title} count={column.tasks.length}/><ul className="todo-list">{column.tasks.length?column.tasks.map(renderTask):<li className={styles.empty}>No tasks</li>}</ul></section>)}</div>;
}
