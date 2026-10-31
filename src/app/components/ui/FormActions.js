import styles from './FormActions.module.css';
/** Primary action first, cancellation last, in visual and keyboard order. */
export default function FormActions({children,primary,cancel,className=''}) {
 return <div className={`${styles.actions} ${className}`}>{primary}{children}{cancel}</div>;
}
