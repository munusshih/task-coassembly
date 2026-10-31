import PersonIdentity from './ui/PersonIdentity';
import styles from './ProposalReader.module.css';

const text=(value)=>String(value||'').trim();

export default function ProposalReader({data,members=[],revision}) {
 const lead=members.find(member=>member.id===data.leadId);
 const budget=data.budget!==undefined&&data.budget!==''?`NT$ ${Number(data.budget).toLocaleString()}`:'Not estimated';
 const hours=data.hours!==undefined&&data.hours!==''?`${data.hours} hours`:'Not estimated';
 const hasText=['why','outcome','scope','timeline','risks','breakdown'].some(key=>text(data[key]));
 const hasBudget=data.budget!=null&&data.budget!=='';
 const hasHours=data.hours!=null&&data.hours!=='';
 const packages=Array.isArray(data.workItems)?data.workItems.filter(item=>text(item.title)||text(item.owner)): [];
 return <article className={styles.reader}>
  <header className={styles.header}>
   <div className={styles.eyebrow}><span>{data.proposalType||'Idea'}</span><span>Revision {revision}</span></div>
   <h1>{data.text||'Untitled proposal'}</h1>
   {(data.authorId||data.authorName)&&<PersonIdentity member={members.find(member=>member.id===data.authorId)} name={data.authorName}/>}
  </header>

  <dl className={styles.summary}>
   {hasBudget&&<div><dt>Requested budget</dt><dd>{budget}</dd></div>}
   {hasHours&&<div><dt>Estimated team time</dt><dd>{hours}</dd></div>}
   {data.leadId&&<div><dt>Proposal lead</dt><dd><PersonIdentity member={lead}/></dd></div>}
  </dl>

  {!hasText&&!packages.length&&<section className={styles.section}><h2>Develop this idea</h2><p>This is an early draft. Use Revise proposal to add the need, a concrete result, and an estimate before asking for review.</p></section>}
  {(text(data.why)||text(data.outcome))&&<section className={styles.section}>
   <span>01 · Need</span><h2>The case for change</h2>
   {text(data.why)&&<p>{data.why}</p>}
   {text(data.outcome)&&<><h3>Intended result</h3><p>{data.outcome}</p></>}
  </section>}

  {(text(data.scope)||text(data.timeline)||text(data.risks))&&<section className={styles.section}>
   <span>02 · Plan</span><h2>The proposed work</h2>
   {text(data.scope)&&<p>{data.scope}</p>}
   {text(data.timeline)&&<><h3>Timing</h3><p>{data.timeline}</p></>}
   {text(data.risks)&&<><h3>Dependencies and open questions</h3><p>{text(data.risks)}</p></>}
  </section>}

  {(packages.length>0||text(data.breakdown))&&<section className={styles.section}>
   <span>03 · Resources</span><h2>People, time, and money</h2>
   {packages.length>0?<ol className={styles.packages}>{packages.map((item,index)=><li key={`${item.title}-${index}`}>
    <h3>{item.title||`Work package ${index+1}`}</h3>
    <dl><div><dt>Owner</dt><dd>{text(item.owner)||'Not assigned'}</dd></div><div><dt>Cost</dt><dd>{item.cost!==''&&item.cost!=null?`NT$ ${Number(item.cost).toLocaleString()}`:'Not estimated'}</dd></div><div><dt>Team time</dt><dd>{item.hours!==''&&item.hours!=null?`${item.hours} hours`:'Not estimated'}</dd></div></dl>
   </li>)}</ol>:text(data.breakdown)?<p>{data.breakdown}</p>:<p>The estimate has not been broken down yet.</p>}
  </section>}
 </article>;
}
