import styles from './WorkspaceViewPicker.module.css';

/** The shared underlined grouping selector used in every workspace hero. */
export default function WorkspaceViewPicker({ value, onChange, options, label = 'Page grouping', prefix = 'by' }) {
  const selected=options.find(option=>option.value===value)?.label||value;
  return (
    <label data-rationale-anchor="page-view" data-rationale-label={label} className={`task-view-picker ${styles.picker}`}>
      <span className={styles.prefix}>{prefix}</span>
      <span className={styles.control}><span className={styles.measure} aria-hidden="true">{selected}</span><select data-workspace-view className={styles.select} aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></span>
    </label>
  );
}
