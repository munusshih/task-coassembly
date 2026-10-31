import {DEFAULT_TYPOGRAPHY,ORIGINAL_TYPOGRAPHY,FONT_CHOICES,TYPE_ROLES,typographyPreferences} from '../../lib/typography.mjs';
import SelectField from './SelectField';
import styles from './TypographySettings.module.css';
export default function TypographySettings({value,onChange}) {
 const selected=typographyPreferences(value);
 const matches=preset=>TYPE_ROLES.every(role=>selected[role.key]===preset[role.key]);
 return <div className={styles.settings}>
  <div className={styles.presets}><div role="group" aria-label="Font presets"><button type="button" aria-pressed={matches(ORIGINAL_TYPOGRAPHY)} onClick={()=>onChange(ORIGINAL_TYPOGRAPHY)}>Original</button><button type="button" aria-pressed={matches(DEFAULT_TYPOGRAPHY)} onClick={()=>onChange(DEFAULT_TYPOGRAPHY)}>Assembly mix</button></div></div>
  <div className={styles.roles}>{TYPE_ROLES.map(role=><div className={styles.role} key={role.key}>
   <div className={styles.roleControls}><div><label htmlFor={`settings-${role.key}`}>{role.label}</label></div><SelectField id={`settings-${role.key}`} aria-label={role.label} value={selected[role.key]} onChange={event=>onChange({[role.key]:event.target.value})}>{role.choices.map(key=><option key={key} value={key}>{FONT_CHOICES[key].label}</option>)}</SelectField></div>
   <p aria-label={`${role.label} preview`} className={`${styles.sample} ${role.key==='fontHeading'?styles.heading:role.key==='fontLabel'?styles.label:styles.body}`} style={{fontFamily:FONT_CHOICES[selected[role.key]].family}}>{role.sample}</p>
  </div>)}</div>
 </div>;
}
