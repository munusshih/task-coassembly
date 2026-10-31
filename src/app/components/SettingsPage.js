'use client';
import TypographySettings from './ui/TypographySettings';
import {DEFAULT_TYPOGRAPHY,typographyVariables} from '../lib/typography.mjs';
import {useEffect,useState} from 'react';
import {subscribeCollection,updateDocument} from '../../firestore';
import {pronounsForInput} from '../lib/pronouns.mjs';
import TabPage from './ui/TabPage';
import WorkspacePageHero from './ui/WorkspacePageHero';
import SectionBlock from './ui/SectionBlock';
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
 return <TabPage className="settings-page" header={<WorkspacePageHero title="Settings"/>}><div className="settings-grid"><SectionBlock title="Typography"><div aria-label="Typography"><TypographySettings value={preferences} onChange={preference}/></div></SectionBlock><SectionBlock title="Accessibility"><FormField label="Text size"><SelectField value={preferences.textSize} onChange={event=>preference({textSize:event.target.value})}><option value="standard">Standard</option><option value="large">Large</option><option value="larger">Extra large</option></SelectField></FormField><label className="settings-toggle"><input type="checkbox" checked={preferences.contrast} onChange={event=>preference({contrast:event.target.checked})}/>Stronger text and borders</label><label className="settings-toggle"><input type="checkbox" checked={preferences.reduceMotion} onChange={event=>preference({reduceMotion:event.target.checked})}/>Reduce animation</label><label className="settings-toggle"><input type="checkbox" checked={preferences.compact} onChange={event=>preference({compact:event.target.checked})}/>Compact cards</label><FormField label="Default focus duration · minutes"><InputField type="number" min="1" max="240" value={preferences.focusMinutes} onChange={event=>{const minutes=Number(event.target.value);if(minutes>=1&&minutes<=240)preference({focusMinutes:minutes});}}/></FormField><p>Display and focus preferences apply to this browser.</p></SectionBlock><SectionBlock title="Color palette"><p>Choose the accent colors used for projects, planning, and clocks.</p><div className="settings-palettes" role="group" aria-label="Color palette">{Object.entries({original:'Original',garden:'Garden',dusk:'Dusk'}).map(([key,label])=><button type="button" key={key} aria-pressed={preferences.palette===key} onClick={()=>preference({palette:key})}><span className={`palette-swatch palette-swatch--${key}`} aria-hidden="true"/>{label}</button>)}</div><Button variant="ghost" onClick={()=>preference({...defaults})}>Reset preferences</Button></SectionBlock><details className="settings-profile"><summary>Your profile</summary><SectionBlock header={false}>{member&&draft?<form onSubmit={save}><h3>{member.data.name}</h3>{[['email','Email','email'],['pronouns','Pronouns','text'],['photoURL','Photo URL','url']].map(([key,label,type])=><FormField key={key} label={label}><InputField type={type} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></FormField>)}<Button type="submit" disabled={busy}>Save profile</Button></form>:<p>Loading your profile…</p>}</SectionBlock></details></div><p role="status">{message}</p></TabPage>;
}
