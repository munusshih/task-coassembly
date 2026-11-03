'use client';

import {useEffect,useRef,useState} from 'react';
import {subscribeCollection,updateDocument} from '../../firestore';
import {pronounsForInput} from '../lib/pronouns.mjs';
import {DEFAULT_TYPOGRAPHY,ORIGINAL_TYPOGRAPHY,TYPE_ROLES} from '../lib/typography.mjs';
import {COLOR_ROLES,DEFAULT_PREFERENCES,paletteColors} from '../lib/preferences.mjs';
import {savePreferences,usePreferences} from '../lib/preferences';
import TabPage from './ui/TabPage';
import WorkspacePageHero from './ui/WorkspacePageHero';
import WorkspaceViewPicker from './ui/WorkspaceViewPicker';
import HeadingCount from './ui/HeadingCount';
import CollectionLayout from './ui/CollectionLayout';
import SearchField from './ui/SearchField';
import EmptyState from './ui/EmptyState';
import TypographySettings from './ui/TypographySettings';
import MetadataPill from './ui/MetadataPill';
import ActionLink from './ui/ActionLink';
import ModalShell from './ui/ModalShell';
import FormField from './ui/FormField';
import InputField from './ui/InputField';
import SelectField from './ui/SelectField';
import Button from './Button';
import NoteMarkdownEditor from './NoteMarkdownEditor';
import prose from './ui/NoteProse.module.css';
import styles from './SettingsPage.module.css';

const GROUPS=['Appearance','Writing','Focus','Profile'];
const CATALOG=[
 ...TYPE_ROLES.map(role=>({key:role.key,title:role.label,group:'Appearance',kind:'font',role})),
 {key:'palette',title:'Workspace colors',group:'Appearance',wide:true},
 {key:'textSize',title:'Text size',group:'Appearance'},
 {key:'compact',title:'Spacing',group:'Appearance'},
 {key:'contrast',title:'Contrast',group:'Appearance'},
 {key:'reduceMotion',title:'Motion',group:'Appearance'},
 {key:'editorMode',title:'Note editor',group:'Writing'},
 {key:'noteGuides',title:'Note paper',group:'Writing'},
 {key:'readingWidth',title:'Reading width',group:'Writing'},
 {key:'focusMinutes',title:'Focus duration',group:'Focus'},
 {key:'focusMode',title:'Focus timer',group:'Focus'},
 {key:'profile',title:'Your member profile',group:'Profile',wide:true},
].map((item,index)=>({...item,index:String.fromCharCode(65+index)}));
const DEMO='# Working together\n\nA shared place for ideas, decisions, and the next step.\n\n## Next steps\n\n- [ ] Read the proposal\n- [ ] Share a thought\n\n把想法變成共同的行動。';

export default function SettingsPage({viewerName=''}) {
 const preferences=usePreferences();
 const [group,setGroup]=useState('all'),[search,setSearch]=useState(''),[message,setMessage]=useState('');
 const [member,setMember]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(false),[previewContent,setPreviewContent]=useState(DEMO);
 const [duration,setDuration]=useState(String(preferences.focusMinutes)),[durationError,setDurationError]=useState('');
 const memberId=useRef(null);
 useEffect(()=>setDuration(String(preferences.focusMinutes)),[preferences.focusMinutes]);
 useEffect(()=>subscribeCollection('members',items=>{
  const person=items.find(item=>String(item.data.name||'').toLowerCase()===viewerName.toLowerCase());
  setMember(person||null);
  if(person && memberId.current!==person.id){memberId.current=person.id;setDraft({email:person.data.email||'',pronouns:pronounsForInput(person.data.pronouns),photoURL:person.data.photoURL||''});}
 }),[viewerName]);
 function preference(patch){try{savePreferences(patch);setMessage('Saved on this browser.');}catch{setMessage('Could not save preferences. Check browser storage and try again.');}}
 function commitDuration(){const value=Number(duration);if(!Number.isInteger(value)||value<1||value>240){setDurationError('Use a whole number from 1 to 240.');return;}setDurationError('');preference({focusMinutes:value});}
 async function saveProfile(event){event.preventDefault();if(!member||!draft)return;setBusy(true);try{await updateDocument('members',member.id,{...draft,updatedAt:Date.now()});setMessage('Profile saved to the workspace.');}catch(error){setMessage(error.message);}finally{setBusy(false);}}
 function choice(key,options){return <SelectField aria-label={CATALOG.find(item=>item.key===key)?.title||key} value={String(preferences[key])} onChange={event=>preference({[key]:typeof preferences[key]==='boolean'?event.target.value==='true':event.target.value})}>{options.map(([value,label])=><option value={String(value)} key={String(value)}>{label}</option>)}</SelectField>;}
 function control(item){
  switch(item.key){
   case 'fontHeading':case 'fontBody':case 'fontLabel':return <TypographySettings role={item.role} value={preferences} onChange={preference}/>;
   case 'palette':{const colors=paletteColors(preferences);return <>
    {choice('palette',[['original','Original'],['garden','Garden'],['dusk','Dusk'],['custom','Custom']])}
    <div className={styles.colors}>{COLOR_ROLES.map(key=><label key={key}><span>{key[0].toUpperCase()+key.slice(1)}</span><span className={styles.colorValue}><input type="color" aria-label={`${key} color`} value={colors[key]} onChange={event=>preference({palette:'custom',customColors:{[key]:event.target.value}})}/><code>{colors[key]}</code></span></label>)}</div>
    <div className={styles.pills}><MetadataPill tone="project">Project</MetadataPill><MetadataPill tone="worked">25m worked</MetadataPill><MetadataPill tone="planned">1h planned</MetadataPill><MetadataPill tone="date">Today</MetadataPill></div>
   </>;}
   case 'textSize':return <>{choice('textSize',[['standard','Standard · 20 px'],['large','Large · 22 px'],['larger','Extra large · 24 px']])}<p className={styles.bodySample}>A little more room to read, plan, and think.</p></>;
   case 'compact':return <>{choice('compact',[[false,'Comfortable'],[true,'Compact']])}<div className={styles.spacingSample}><span>Task</span><span>Project</span><span>Note</span></div><p>Changes spacing in task lists and the Project, Note, Resource, and Wish indexes.</p></>;
   case 'contrast':return <>{choice('contrast',[[false,'Standard'],[true,'Stronger']])}<p className={styles.contrastSample}>Supporting text stays readable.</p><p>Strengthens supporting text and control edges throughout Protocol.</p></>;
   case 'reduceMotion':return <>{choice('reduceMotion',[[false,'Follow system'],[true,'Reduce animation']])}<img className={styles.motionSample} src="/icon.svg" alt="Animation preview"/><p>Applies to page transitions, drawers, and illustrations.</p></>;
   case 'editorMode':return <>{choice('editorMode',[['write','Write'],['split','Split'],['preview','Preview']])}<p>Choose how a note opens when you start editing.</p><Button variant="secondary" onClick={()=>setPreview(true)}>Try the editor</Button></>;
   case 'noteGuides':return <>{choice('noteGuides',[[true,'Ruled paper'],[false,'Plain paper']])}<div className={`${styles.paperSample} ${prose.paper}`}><div className={prose.prose}><p>A place for shared ideas.<br/>A record of what comes next.<br/>想法、決定與下一步。</p></div></div></>;
   case 'readingWidth':return <>{choice('readingWidth',[['comfortable','Comfortable · 780 px'],['wide','Wide · 1040 px']])}<p>Sets the reading column and Markdown writing width.</p><ActionLink href="/notes">Open Note</ActionLink></>;
   case 'focusMinutes':return <><div className={styles.duration}><InputField aria-label="Focus duration in minutes" type="number" min="1" max="240" step="1" value={duration} onChange={event=>setDuration(event.target.value)} onBlur={commitDuration} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commitDuration();}}} aria-invalid={Boolean(durationError)} aria-describedby={durationError?'focus-duration-error':undefined}/><span>minutes</span></div>{durationError&&<p id="focus-duration-error" role="alert">{durationError}</p>}<div className={styles.presets}>{[25,45,60].map(minutes=><Button key={minutes} variant={preferences.focusMinutes===minutes?'primary':'secondary'} onClick={()=>{setDurationError('');preference({focusMinutes:minutes});}}>{minutes} min</Button>)}</div><p>Used for your next session. A running timer keeps its current duration.</p></>;
   case 'focusMode':return <>{choice('focusMode',[['countdown','Countdown'],['stopwatch','Stopwatch']])}<div className={styles.timerSample}><img src="/illustrations/clock.svg" alt=""/><output aria-label="Next focus session preview">{preferences.focusMode==='stopwatch'?'00:00':`${String(preferences.focusMinutes).padStart(2,'0')}:00`}</output></div><ActionLink href="/tasks">Open Task</ActionLink></>;
   case 'profile':return member&&draft?<form className={styles.profile} onSubmit={saveProfile}><div className={styles.profileIdentity}><strong>{member.data.name}</strong><ActionLink href={`/members?profile=${encodeURIComponent(member.id)}`}>View profile</ActionLink></div><div className={styles.profileFields}>{[['email','Email','email'],['pronouns','Pronouns','text'],['photoURL','Photo URL','url']].map(([key,label,type])=><FormField key={key} label={label}><InputField type={type} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></FormField>)}</div><div><Button type="submit" disabled={busy}>{busy?'Saving…':'Save profile'}</Button></div><p>These details are shared with your workspace. Appearance and writing preferences stay on this browser.</p></form>:<p>Your member profile is not available.</p>;
   default:return null;
  }
 }
 const query=search.trim().toLowerCase();
 const visible=CATALOG.filter(item=>(group==='all'||item.group===group)&&`${item.title} ${item.group} ${item.key} ${item.role?.description||''}`.toLowerCase().includes(query));
 return <TabPage className={`settings-page ${styles.page}`} header={<WorkspacePageHero title="Settings" illustration="task-maker"><WorkspaceViewPicker label="Settings group" prefix="for" value={group} onChange={setGroup} options={[{value:'all',label:'All pages'},...GROUPS.map(value=>({value,label:value}))]}/></WorkspacePageHero>}>
  <div className={styles.toolbar}><SearchField value={search} onChange={event=>setSearch(event.target.value)} onClear={()=>setSearch('')} ariaLabel="Search settings" placeholder="Find a setting…"/><p role="status">{message||'Preferences save on this browser.'}</p></div>
  <div className={styles.index}>
   {GROUPS.map(category=>{const items=visible.filter(item=>item.group===category);if(!items.length)return null;return <section className={styles.group} key={category} aria-label={category}>
    <div className={styles.groupHead}><HeadingCount as="h2" title={category} count={items.length}/>{category==='Appearance'&&<div className={styles.presets}><Button variant="secondary" onClick={()=>preference(ORIGINAL_TYPOGRAPHY)}>Original type</Button><Button variant="secondary" onClick={()=>preference(DEFAULT_TYPOGRAPHY)}>Assembly mix</Button></div>}</div>
    <CollectionLayout className={styles.grid}>{items.map(item=><article key={item.key} className={`${styles.setting} ${item.wide?styles.wide:''}`} aria-labelledby={`setting-${item.key}`}><header><span aria-hidden="true">{item.index}</span><h3 id={`setting-${item.key}`}>{item.title}</h3></header><div className={styles.control}>{control(item)}</div></article>)}</CollectionLayout>
   </section>;})}
   {!visible.length&&<EmptyState>No settings match “{search}”. <button type="button" onClick={()=>{setSearch('');setGroup('all');}}>Show all settings</button></EmptyState>}
  </div>
  <footer className={styles.footer}><p>{CATALOG.length} settings · Changes appear across Protocol.</p><Button variant="ghost" onClick={()=>{preference(DEFAULT_PREFERENCES);setDurationError('');}}>Reset browser preferences</Button></footer>
  {preview&&<ModalShell fullscreen title="Writing preview · no notes are saved" onClose={()=>setPreview(false)} bodyClassName={styles.editorPreview}><NoteMarkdownEditor value={previewContent} onChange={setPreviewContent}/></ModalShell>}
 </TabPage>;
}
