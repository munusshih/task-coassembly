'use client';
import FormField from './ui/FormField';
import InputField from './ui/InputField';
import SelectField from './ui/SelectField';
import MemberSelect from './ui/MemberSelect';
import TextareaField from './ui/TextareaField';
import Button from './Button';
import IconButton from './IconButton';
import {DELETE_ICON} from './icons';
import {PROPOSAL_TYPES,proposalPlanTotals} from './proposalModel.mjs';
import styles from './ProposalEditor.module.css';

export default function ProposalEditor({draft,onChange,members,onSave,busy,canSave}) {
 const patch=values=>onChange({...draft,...values});
 const rows=draft.workItems||[];
 function updateRows(next) {
  const totals=proposalPlanTotals(next);
  patch({
   workItems:next,
   budget:String(totals.budget),
   hours:String(totals.hours),
   breakdown:next.map(row=>`${row.title||'Work item'} · ${row.owner||'Owner needed'} · NT$ ${row.cost||0} · ${row.hours||0}h`).join('\n'),
  });
 }
 function updateRow(index,values) {
  updateRows(rows.map((item,position)=>position===index?{...item,...values}:item));
 }
 const textField=(key,label,placeholder,required=false)=><FormField label={label} key={key}><TextareaField value={draft[key]||''} placeholder={placeholder} rows={3} onChange={event=>patch({[key]:event.target.value})}/>{required&&<span className={styles.hint}>Needed before submitting for review</span>}</FormField>;

 return <form className={styles.editor} onSubmit={event=>{event.preventDefault();onSave();}}>
  <header className={styles.intro}>
   <span>Proposal</span>
   <h2>Make the idea clear enough to decide on.</h2>
   <p>Describe the need, the change you propose, who will do the work, and what it will take. Save a draft while details are still being worked out.</p>
  </header>

  <section className={styles.section} aria-labelledby="proposal-case">
   <div className={styles.sectionHeading}><span>01</span><div><h3 id="proposal-case">The case for change</h3><p>What is happening, and who would benefit?</p></div></div>
   <div className={styles.fields}>
    <FormField label="Proposal title"><InputField value={draft.text} placeholder="A short, specific name" onChange={event=>patch({text:event.target.value})}/></FormField>
    <FormField label="Kind of work"><SelectField value={draft.proposalType} onChange={event=>patch({proposalType:event.target.value})}>{PROPOSAL_TYPES.map(type=><option key={type}>{type}</option>)}</SelectField></FormField>
    {textField('why','Need and evidence','What problem or opportunity are we responding to? Include who is affected and what you know.',true)}
    {textField('outcome','What should change?','Describe the result and how the team will recognize that it worked.',true)}
   </div>
  </section>

  <section className={styles.section} aria-labelledby="proposal-plan">
   <div className={styles.sectionHeading}><span>02</span><div><h3 id="proposal-plan">The proposed work</h3><p>Make the scope and responsibility tangible.</p></div></div>
   <div className={styles.fields}>
    <FormField label="Proposal lead"><MemberSelect members={members.filter(member=>member.data.active!==false)} value={draft.leadId||''} onChange={leadId=>patch({leadId})} label="Proposal lead" placeholder="Choose a person responsible for coordination"/></FormField>
    {textField('scope','Deliverables and boundaries','What will be made or done? What is explicitly out of scope?',true)}
    {textField('timeline','Timing and milestones','When could work start? Note a first milestone and a realistic target date.',true)}
    {textField('risks','Dependencies and open questions','What needs to happen first? What could change the plan?',false)}
   </div>
  </section>

  <section className={styles.section} aria-labelledby="proposal-resources">
   <div className={styles.sectionHeading}><span>03</span><div><h3 id="proposal-resources">People, time, and money</h3><p>Estimate the work so members can assess the trade-offs.</p></div></div>
   {rows.length>0?<div className={styles.workItems}>
    {rows.map((item,index)=><fieldset className={styles.workItem} key={index}>
     <legend>Work package {index+1}</legend>
     <FormField label="Deliverable"><InputField aria-label={`Work item ${index+1}`} value={item.title} placeholder="e.g. Research and recommendations" onChange={event=>updateRow(index,{title:event.target.value})}/></FormField>
     <FormField label="Owner"><InputField aria-label={`Owner for item ${index+1}`} value={item.owner} placeholder="Person or supplier" onChange={event=>updateRow(index,{owner:event.target.value})}/></FormField>
     <FormField label="Cost · TWD"><InputField aria-label={`Cost for item ${index+1}`} type="number" min="0" step="any" value={item.cost} placeholder="0" onChange={event=>updateRow(index,{cost:event.target.value})}/></FormField>
     <FormField label="Team hours"><InputField aria-label={`Hours for item ${index+1}`} type="number" min="0" step="any" value={item.hours} placeholder="0" onChange={event=>updateRow(index,{hours:event.target.value})}/></FormField>
     <IconButton type="button" variant="delete" title={`Remove work package ${index+1}`} aria-label={`Remove work package ${index+1}`} onClick={()=>updateRows(rows.filter((_,position)=>position!==index))}>{DELETE_ICON}</IconButton>
    </fieldset>)}
    <Button variant="ghost" type="button" onClick={()=>updateRows([...rows,{title:'',owner:'',cost:'',hours:''}])}>+ Add work package</Button>
   </div>:<div className={styles.fields}>
    <p className={styles.guidance}>No work packages yet. Add one to estimate by deliverable, or enter totals for an early draft.</p>
    <FormField label="Total requested · TWD"><InputField type="number" min="0" step="any" value={draft.budget} placeholder="0" onChange={event=>patch({budget:event.target.value})}/></FormField>
    <FormField label="Total team hours"><InputField type="number" min="0" step="any" value={draft.hours} placeholder="0" onChange={event=>patch({hours:event.target.value})}/></FormField>
    {textField('breakdown','How was this estimated?','Note the people, rates, quantities, or assumptions behind the totals.',true)}
    <Button variant="ghost" type="button" onClick={()=>updateRows([{title:'',owner:'',cost:'',hours:''}])}>Break this estimate into work packages</Button>
   </div>}
  </section>

  <footer className={styles.actions}>
   <p>A draft can be incomplete. The review step checks that the proposal has enough detail to discuss.</p>
   <Button type="submit" disabled={busy||!canSave||!draft.text.trim()}>{busy?'Saving…':'Save draft'}</Button>
  </footer>
 </form>;
}
