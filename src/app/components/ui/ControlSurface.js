import styles from './ControlSurface.module.css';
/** Shared visual interaction for text actions, icon actions, and action links. */
export default function ControlSurface({as:Tag='button',tone='quiet',className='',...props}) {
 return <Tag className={`${styles.surface} ${styles[tone]||styles.quiet} ${className}`} {...props}/>;
}
