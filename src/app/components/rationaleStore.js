import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { isWorkerOwner } from '../../authAccess';
import { requireActionReason } from '../../lib/actionReason.mjs';
import { validateRationale, assertRationaleRevision, assertRationaleAuthor } from './rationaleNotes.mjs';
export async function saveRationale(id, draft, member, expectedRevision = 0) {
  if (!member?.id || member.active === false) throw new Error('Sign in as an active member to edit your notes.');
  const fields = validateRationale(draft);
  if (!db) throw new Error('The shared workspace is not available.');
  await runTransaction(db, async transaction => {
    const ref=doc(db,'workspaceRationales',id);
    const snapshot=await transaction.get(ref);
    const current=snapshot.exists()?snapshot.data():null;
    if(current)assertRationaleAuthor(current,member.id);
    else if(!isWorkerOwner(member))throw new Error('Only worker-owners can add notes.');
    assertRationaleRevision(current,expectedRevision);
    if(current?.deleted)throw new Error('This note has been removed.');
    const now=Date.now();
    transaction.set(ref,{...fields,deleted:false,createdAt:current?.createdAt || now,createdBy:current?.createdBy || member.id,createdByName:current?.createdByName || member.name || member.id,editorMemberId:member.id,editedByName:member.name || member.id,updatedAt:now,revision:expectedRevision+1});
  });
}

export async function deleteRationale(id,member,expectedRevision,reason) {
 if(!member?.id||member.active===false)throw new Error('Sign in as an active member to manage your notes.');
 const explanation=requireActionReason(reason);
 await runTransaction(db,async transaction=>{
  const ref=doc(db,'workspaceRationales',id),snapshot=await transaction.get(ref);
  const current=snapshot.exists()?snapshot.data():null;
  assertRationaleAuthor(current,member.id);
  assertRationaleRevision(current,expectedRevision);
  transaction.update(ref,{deleted:true,deleteReason:explanation,deletedAt:Date.now(),updatedAt:Date.now(),editorMemberId:member.id,editedByName:member.name||member.id,revision:expectedRevision+1});
 });
}

export async function archiveRationale(note,member) {
 if(!member?.id||member.active===false)throw new Error('Sign in as an active member to archive notes.');
 if(!db)throw new Error('The shared workspace is not available.');
 await runTransaction(db,async transaction=>{
  const ref=doc(db,'workspaceRationales',note.id),snapshot=await transaction.get(ref);
  const current=snapshot.exists()?snapshot.data():null;
  assertRationaleRevision(current,note.data.revision||0);
  if(current?.deleted)throw new Error('This note has been removed.');
  const metadata={archived:!current?.archived,updatedAt:Date.now(),editorMemberId:member.id,editedByName:member.name||member.id,revision:(current?.revision||0)+1};
  if(current)transaction.update(ref,metadata);
  else transaction.set(ref,{...validateRationale(note.data),...metadata,deleted:false,createdAt:Date.now(),createdBy:member.id,createdByName:member.name||member.id});
 });
}
