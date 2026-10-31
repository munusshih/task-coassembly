'use client';
import TypographySettings from './ui/TypographySettings';
import {DEFAULT_TYPOGRAPHY,typographyVariables} from '../lib/typography.mjs';
import {useEffect,useState} from 'react';
import {subscribeCollection,updateDocument} from '../../firestore';
import {pronounsForInput} from '../lib/pronouns.mjs';
import TabPage from './ui/TabPage';
import WorkspacePageHero from './ui/WorkspacePageHero';
import styles from './SettingsPage.module.css';
import FormField from './ui/FormField';
import InputField from './ui/InputField';
import Button from './Button';
import SelectField from './ui/SelectField';
const defaults={...DEFAULT_TYPOGRAPHY,reduceMotion:false,compact:false,focusMinutes:25,textSize:'standard',contrast:false,palette:'original'};
const palettes={original:{},garden:{'palette-project':'#dbe7ce','palette-worked':'#d4e6df','palette-planned':'#f0e3c7','palette-date':'#edd6c9','cover-2':'#cbdca9','cover-4':'#b3cfc9'},dusk:{'palette-project':'#e1dced','palette-worked':'#d5e4ed','palette-planned':'#eee0ce','palette-date':'#f0d8df','cover-2':'#e1c4d7','cover-4':'#bfc4e2'}};
const paletteKeys=[...new Set(Object.values(palettes).flatMap(palette=>Object.keys(palette)))];
export function applyPreferences(value){
 value={...defaults,...value};
 const root=document.documentElement;
 Object.entries(typographyVariables(value)).forEach(([key,family])=>root.style.setProperty(key,family));
 root.dataset.motion=value.reduceMotion?'reduced':'system';root.dataset.density=value.compact?'compact':'comfortable';root.dataset.textSize=value.textSize||'standard';root.dataset.contrast=value.contrast?'high':'standard';
 paletteKeys.forEach(key=>root.style.removeProperty(`--${key}`));
 Object.entries(palettes[value.palette]||{}).forEach(([key,color])=>root.style.setProperty(`--${key}`,color));
}
export default function SettingsPage({viewerName=''}) {
 const [member,setMember]=useState(null),[draft,setDraft]=useState(null),[preferences,setPreferences]=useState(defaults),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{try{const value={...defaults,...JSON.parse(localStorage.getItem('protocol-preferences')||'{}')};setPreferences(value);applyPreferences(value);}catch{}return subscribeCollection('members',items=>{const person=items.find(item=>String(item.data.name||'').toLowerCase()===viewerName.toLowerCase());setMember(person);setDraft(previous=>previous||{email:person?.data.email||'',pronouns:pronounsForInput(person?.data.pronouns),photoURL:person?.data.photoURL||''});});},[viewerName]);
 function preference(patch){const value={...preferences,...patch};setPreferences(value);localStorage.setItem('protocol-preferences',JSON.stringify(value));applyPreferences(value);window.dispatchEvent(new Event('protocol:preferences'));setMessage('Preferences saved on this browser.');}
 async function save(event){event.preventDefault();setBusy(true);try{await updateDocument('members',member.id,{...draft,updatedAt:Date.now()});setMessage('Profile saved.');}catch(error){setMessage(error.message);}finally{setBusy(false);}}
 return <TabPage className={`settings-page ${styles.page}`} header={<WorkspacePageHero title="Settings"/>}>
  <div className={styles.layout}>
   <div className={styles.intro}><p>Make Protocol comfortable for the way you work.</p><span>Preferences apply to this browser</span></div>
   <section className={styles.section} aria-labelledby="settings-appearance">
    <header className={styles.sectionHeading}><h2 id="settings-appearance">Appearance</h2><p>Set the colors, type, and spacing of your workspace.</p></header>
    <div className={styles.sectionContent}>
     <div className={styles.settingBlock}><div className={styles.settingTitle}><h3>Color palette</h3><p>Accent colors for projects, planning, and clocks.</p></div>
      <div className={styles.palettes} role="group" aria-label="Color palette">{Object.entries({original:'Original',garden:'Garden',dusk:'Dusk'}).map(([key,label])=><button type="button" key={key} aria-pressed={preferences.palette===key} onClick={()=>preference({palette:key})}><span className={`palette-swatch palette-swatch--${key}`} aria-hidden="true"/><span>{label}<span className={styles.selection}>{preferences.palette===key?'Selected':''}</span></span></button>)}</div>
     </div>
     <div className={styles.settingBlock}><div className={styles.settingTitle}><h3>Typography</h3><p>Three text levels, with a live preview of each font.</p></div><TypographySettings value={preferences} onChange={preference}/></div>
     <PreferenceToggle title="Compact cards" description="Use less space between items in your workspace." checked={preferences.compact} onChange={checked=>preference({compact:checked})}/>
    </div>
   </section>
   <section className={styles.section} aria-labelledby="settings-reading">
    <header className={styles.sectionHeading}><h2 id="settings-reading">Reading & accessibility</h2><p>Adjust legibility and motion to suit your needs.</p></header>
    <div className={styles.sectionContent}>
     <div className={styles.controlRow}><div className={styles.settingTitle}><label htmlFor="settings-text-size">Text size</label><p>Applies throughout the interface.</p></div><SelectField id="settings-text-size" value={preferences.textSize} onChange={event=>preference({textSize:event.target.value})}><option value="standard">Standard</option><option value="large">Large</option><option value="larger">Extra large</option></SelectField></div>
     <PreferenceToggle title="Stronger text and borders" description="Increase contrast for clearer edges and text." checked={preferences.contrast} onChange={checked=>preference({contrast:checked})}/>
     <PreferenceToggle title="Reduce animation" description="Keep transitions and movement to a minimum." checked={preferences.reduceMotion} onChange={checked=>preference({reduceMotion:checked})}/>
    </div>
   </section>
   <section className={styles.section} aria-labelledby="settings-focus">
    <header className={styles.sectionHeading}><h2 id="settings-focus">Focus</h2><p>Choose a starting point for your focus sessions.</p></header>
    <div className={styles.sectionContent}><div className={styles.controlRow}><div className={styles.settingTitle}><label htmlFor="settings-focus-duration">Default duration</label><p>Between 1 and 240 minutes.</p></div><div className={styles.duration}><InputField id="settings-focus-duration" type="number" min="1" max="240" value={preferences.focusMinutes} onChange={event=>{const minutes=Number(event.target.value);if(minutes>=1&&minutes<=240)preference({focusMinutes:minutes});}}/><span>minutes</span></div></div></div>
   </section>
   <section className={styles.section} aria-labelledby="settings-profile">
    <header className={styles.sectionHeading}><h2 id="settings-profile">Profile</h2><p>Your details are shared with the workspace.</p></header>
    <div className={styles.sectionContent}><details className={styles.profile}><summary><span>{member?.data.name || 'Your profile'}</span><span>Edit profile</span></summary>{member&&draft?<form onSubmit={save}>{[['email','Email','email'],['pronouns','Pronouns','text'],['photoURL','Photo URL','url']].map(([key,label,type])=><FormField key={key} label={label}><InputField type={type} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></FormField>)}<div><Button type="submit" disabled={busy}>{busy?'Saving…':'Save profile'}</Button></div></form>:<p>Profile details are not available yet.</p>}</details></div>
   </section>
   <footer className={styles.footer}><div><h2>Reset preferences</h2><p>Restore the default appearance, accessibility, and focus settings. Your profile stays the same.</p></div><Button variant="secondary" onClick={()=>preference({...defaults})}>Reset preferences</Button></footer>
   <p className={styles.saveStatus} role="status">{message || 'Changes to preferences save automatically.'}</p>
  </div>
 </TabPage>;
}

function PreferenceToggle({title,description,checked,onChange}) {
 return <label className={styles.toggle}><span className={styles.settingTitle}><span>{title}</span><span className={styles.description}>{description}</span></span><input type="checkbox" aria-label={title} aria-description={description} checked={checked} onChange={event=>onChange(event.target.checked)}/></label>;
}
