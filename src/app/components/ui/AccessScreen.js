import styles from './AccessScreen.module.css';

/** The quiet access state sits outside the workspace layout and its card styles. */
export default function AccessScreen({children, action}) {
  return <main className={styles.screen}>
    <div className={styles.content}>
      <div className={styles.brand}><img src="/icon.svg" alt=""/>Protocol</div>
      <p className={styles.message} role="status">{children}</p>
      {action}
    </div>
  </main>;
}
