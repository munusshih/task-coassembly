import {DEFAULT_TYPOGRAPHY,ORIGINAL_TYPOGRAPHY,FONT_CHOICES,TYPE_ROLES,typographyPreferences} from '../../lib/typography.mjs';
import FormField from './FormField';
import SelectField from './SelectField';
import Button from '../Button';
import styles from './TypographySettings.module.css';
export default function TypographySettings({value,onChange}) {
 const selected=typographyPreferences(value);
 return <div className={styles.settings}><p>Choose a font for three text levels. Changes appear throughout the interface and stay on this browser.</p><div className={styles.presets}><Button variant="secondary" onClick={()=>onChange(ORIGINAL_TYPOGRAPHY)}>Original</Button><Button variant="secondary" onClick={()=>onChange(DEFAULT_TYPOGRAPHY)}>Assembly mix</Button></div><div className={styles.roles}>{TYPE_ROLES.map(role=><div className={styles.role} key={role.key}><FormField label={role.label}><SelectField aria-label={role.label} value={selected[role.key]} onChange={event=>onChange({[role.key]:event.target.value})}>{role.choices.map(key=><option key={key} value={key}>{FONT_CHOICES[key].label}</option>)}</SelectField></FormField><p className={styles.description}>{role.description}</p><p className={`${styles.sample} ${role.key==='fontHeading'?styles.heading:role.key==='fontLabel'?styles.label:styles.body}`} style={{fontFamily:FONT_CHOICES[selected[role.key]].family}}>{role.sample}</p></div>)}</div></div>;
}
