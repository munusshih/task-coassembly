'use client';
import ProposalBoard from './ProposalBoard';
import ProposalReader from './ProposalReader';
import DiscussionThread from './ui/DiscussionThread';
import {useEffect,useState} from 'react';
import {subscribeCollection,createDocument,transformDocument,convertProposalToProject} from '../../firestore';
import {emptyProposal,validateProposal,validateProposalDraft,reviseProposal,proposalKind,reviewProposal,moveProposal} from './proposalModel.mjs';
import ProposalEditor from './ProposalEditor';
import WorkspaceViewPicker from './ui/WorkspaceViewPicker';
import TabPage from './ui/TabPage';
import WorkspacePageHero from './ui/WorkspacePageHero';
import WorkspaceCreateDock from './ui/WorkspaceCreateDock';
import ModalShell from './ui/ModalShell';
import TextareaField from './ui/TextareaField';
import SearchField from './ui/SearchField';
import Button from './Button';
import styles from './ProposalsPage.module.css';

export default function ProposalsPage({viewerName=''}) {
 const [items,setItems]=useState([]);
 const [members,setMembers]=useState([]);
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('Board');
 const [activeId,setActiveId]=useState(null);
 const [draft,setDraft]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [reason,setReason]=useState('');
 const [pendingMove,setPendingMove]=useState(null);
 const [moveReason,setMoveReason]=useState('');

 useEffect(()=>{
  const unsubscribeItems=subscribeCollection('backlogItems',setItems,err=>setError(err.message));
  const unsubscribeMembers=subscribeCollection('members',setMembers);
  return()=>{unsubscribeItems();unsubscribeMembers();};
 },[]);

 const viewer=members.find(member=>String(member.data.name||'').toLowerCase()===viewerName.toLowerCase());
 const canAct=Boolean(viewer&&viewer.data.active!==false);
 const active=items.find(item=>item.id===activeId);
 const data=active?.data;
 const author=canAct&&(!data?.authorId||data.authorId===viewer.id);
 const revision=data?.revision||1;

 async function perform(action) {
  if(busy)return;
  setBusy(true);
  setError('');
  try { await action(); }
  catch(err) { setError(err.message||'Could not save.'); }
  finally { setBusy(false); }
 }

 async function save() {
  await perform(async()=>{
   validateProposalDraft(draft);
   if(active) {
    await transformDocument('backlogItems',active.id,latest=>{
     if(latest.projectIdCreated)throw new Error('This proposal has become a project.');
     if((latest.revision||1)!==revision)throw new Error('This proposal changed. Reopen the revision before editing.');
     return {...reviseProposal(latest,draft,viewer.id),authorId:latest.authorId||viewer.id,authorName:latest.authorName||viewerName};
    });
   } else {
    const id=await createDocument('backlogItems',{...draft,authorId:viewer.id,authorName:viewerName,status:'Draft',revision:1,votes:{},reviews:[],comments:[],createdAt:Date.now(),updatedAt:Date.now(),archived:false});
    setActiveId(id);
   }
   setDraft(null);
  });
 }

 async function status(next) {
  await perform(()=>transformDocument('backlogItems',active.id,latest=>{
   if(latest.projectIdCreated)throw new Error('This proposal has become a project.');
   if(next==='In review') {
    validateProposal(latest);
    if(latest.authorId&&latest.authorId!==viewer.id)throw new Error('Only the author can submit this proposal.');
    return {status:next,updatedAt:Date.now()};
   }
   return reviewProposal(latest,next,{id:viewer.id,name:viewerName},reason,revision);
  }));
 }

 async function boardMove(id,next,reasonText='',expectedRevision) {
  const item=items.find(item=>item.id===id);
  if(!item||!canAct||busy)return;
  const previous=item.data.status||'Draft';
  if(next===previous)return;
  if(['Approved','Changes requested'].includes(next)&&!reasonText) {
   try { moveProposal(item.data,next,{id:viewer.id,name:viewerName},'Review reason pending',item.data.revision||1); }
   catch(err) { setError(err.message); return; }
   setPendingMove({id,next,revision:item.data.revision||1});
   setMoveReason('');
   return;
  }
  await perform(async()=>{
   if(next==='Project created') {
    if(item.data.status!=='Approved')throw new Error('Approve the current revision before creating a project.');
    await convertProposalToProject(id,proposalKind(item.data.proposalType));
   } else {
    await transformDocument('backlogItems',id,latest=>moveProposal(latest,next,{id:viewer.id,name:viewerName},reasonText,expectedRevision??item.data.revision??1));
   }
   setPendingMove(null);
  });
 }

 const shown=items.filter(item=>
  !item.data.deleted&&(!item.data.archived||filter==='Archived')&&
  (filter==='Board'||filter==='All'||(item.data.archived?'Archived':item.data.status||'Draft')===filter)&&
  `${item.data.text} ${item.data.why||''}`.toLowerCase().includes(query.toLowerCase())
 );

 return <TabPage className="proposals-page" header={
  <WorkspacePageHero title="Wish" illustration="wishes-catcher">
   <WorkspaceViewPicker prefix="by" label="Proposal status" value={filter==='Archived'?'Archived':'Board'} onChange={setFilter} options={[{value:'Board',label:'Status'},{value:'Archived',label:'Archive'}]}/>
  </WorkspacePageHero>
 }>
  <div className="workspace-search"><SearchField ariaLabel="Search proposals" placeholder="Search proposals…" value={query} onChange={event=>setQuery(event.target.value)} onClear={()=>setQuery('')}/></div>
  {error&&<p role="alert">{error}</p>}
  <ProposalBoard items={shown} members={members} canAct={canAct&&!busy} archived={filter==='Archived'} onOpen={item=>{setActiveId(item.id);setDraft(null);setReason('');setError('');}} onMove={boardMove}/>
  <WorkspaceCreateDock label="New proposal" onClick={()=>{setActiveId(null);setDraft(emptyProposal());setError('');}}/>

  {(active||draft)&&<ModalShell fullscreen title={draft?(active?'Revise proposal':'New proposal'):data.text} onClose={()=>{setActiveId(null);setDraft(null);}} className={`proposal-modal ${styles.modal}`}>
   {draft?<ProposalEditor draft={draft} onChange={setDraft} members={members} busy={busy} canSave={canAct} onSave={save}/>:<div className={styles.detail}>
    <ProposalReader data={data} members={members} revision={revision}/>
    <div className={styles.actions}>
     {author&&!data.projectIdCreated&&<Button variant="ghost" onClick={()=>setDraft({...emptyProposal(),...Object.fromEntries(Object.keys(emptyProposal()).map(key=>[key,data[key]??emptyProposal()[key]])),workItems:data.workItems||[]})}>Revise proposal</Button>}
     {author&&!data.projectIdCreated&&data.status!=='In review'&&<Button disabled={busy} onClick={()=>status('In review')}>Submit for review</Button>}
     {data.status==='Approved'&&canAct&&<Button disabled={busy} onClick={()=>perform(async()=>{const id=await convertProposalToProject(active.id,proposalKind(data.proposalType));window.location.assign(`/projects?project=${id}`);})}>Create project</Button>}
     {data.projectIdCreated&&<a href={`/projects?project=${data.projectIdCreated}`}>Open project</a>}
    </div>
    <section className={styles.review}>
     <h2>Review and discussion</h2>
     <p>Support and concerns help members understand this revision. A decision should include its reason.</p>
     <div className={styles.actions}>
      {['Support','Concern'].map(value=><Button key={value} variant={data.votes?.[viewer?.id]?.value===value&&data.votes?.[viewer?.id]?.revision===revision?'primary':'ghost'} disabled={busy||!canAct||data.status!=='In review'} onClick={()=>perform(()=>transformDocument('backlogItems',active.id,latest=>{
       if(latest.status!=='In review')throw new Error('Voting is open during review.');
       return {votes:{...(latest.votes||{}),[viewer.id]:{value,revision:latest.revision||1}},updatedAt:Date.now()};
      }))}>{value} · {Object.values(data.votes||{}).filter(vote=>vote.value===value&&vote.revision===revision).length}</Button>)}
     </div>
     {canAct&&data.authorId!==viewer.id&&data.status==='In review'&&<>
      <TextareaField aria-label="Proposal review reason" placeholder="Explain your decision and any changes needed…" value={reason} onChange={event=>setReason(event.target.value)}/>
      <div className={styles.actions}><Button disabled={busy||!reason.trim()} onClick={()=>status('Approved')}>Approve revision</Button><Button variant="ghost" disabled={busy||!reason.trim()} onClick={()=>status('Changes requested')}>Request changes</Button></div>
     </>}
     {(data.reviews||[]).map((review,index)=><article className={styles.reviewEntry} key={index}><strong>{review.decision} · revision {review.revision}</strong><p>{review.reason}</p><small>{review.authorName}</small></article>)}
    </section>
    <DiscussionThread entries={data.comments||[]} members={members} username={viewerName} busy={busy||!canAct} onSend={async body=>{
     let saved=false;
     await perform(async()=>{await transformDocument('backlogItems',active.id,latest=>({comments:[...(latest.comments||[]),{id:crypto.randomUUID(),body,authorId:viewer.id,authorName:viewerName,createdAt:Date.now()}]}));saved=true;});
     return saved;
    }}/>
    {data.revisions?.length>0&&<details className={styles.history}><summary>Previous revisions · {data.revisions.length}</summary>{data.revisions.map(entry=><article key={entry.revision}><h3>Revision {entry.revision}</h3><p><strong>Title</strong><br/>{entry.snapshot.text}</p><p><strong>Purpose</strong><br/>{entry.snapshot.why||'Not provided'}</p><p><strong>Outcome</strong><br/>{entry.snapshot.outcome||'Not provided'}</p></article>)}</details>}
   </div>}
   {error&&<p role="alert">{error}</p>}
  </ModalShell>}

  {pendingMove&&<ModalShell title={pendingMove.next==='Approved'?'Approve proposal':'Request changes'} onClose={()=>setPendingMove(null)}>
   <p>Record a reason for this decision on revision {pendingMove.revision}.</p>
   <TextareaField aria-label="Decision reason" value={moveReason} onChange={event=>setMoveReason(event.target.value)} placeholder="Explain your decision…"/>
   <Button disabled={busy||!moveReason.trim()} onClick={()=>boardMove(pendingMove.id,pendingMove.next,moveReason,pendingMove.revision)}>{pendingMove.next==='Approved'?'Approve':'Request changes'}</Button>
   {error&&<p role="alert">{error}</p>}
  </ModalShell>}
 </TabPage>;
}
