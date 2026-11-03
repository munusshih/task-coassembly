import {FONT_CHOICES,typographyPreferences} from '../../lib/typography.mjs';
import SelectField from './SelectField';
import styles from './TypographySettings.module.css';
export default function TypographySettings({role,value,onChange}) {
 const selected=typographyPreferences(value)[role.key];
 const sample=role.key==='fontHeading'?'Project':role.key==='fontBody'?'Plan together. Keep ideas, decisions, and the next step in one place. 把想法變成共同的行動。':'PROJECT / TODAY / 25 MIN';
 return <><SelectField aria-label={role.label} value={selected} onChange={event=>onChange({[role.key]:event.target.value})}>{role.choices.map(key=><option key={key} value={key}>{FONT_CHOICES[key].label}</option>)}</SelectField><p className={`${styles.sample} ${role.key==='fontHeading'?styles.heading:role.key==='fontLabel'?styles.label:styles.body}`} style={{fontFamily:FONT_CHOICES[selected].family}}>{sample}</p></>;
}
