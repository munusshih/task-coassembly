import styles from './NoteNumber.module.css';
const illustrations={why:'asterisk',rule:'review-circle',guide:'book-carrier',question:'help-hat',decision:'approve-person',live:'clock'};
export default function NoteNumber({number,kind='why',label}) {
 return <span className={styles.marker} aria-hidden="true"><img src={`/illustrations/${illustrations[kind]||'asterisk'}.svg`} alt=""/>{number!=null&&<span className={styles.badge}>{number}</span>}{label&&<span className={styles.label}>{label}</span>}</span>;
}
