import {taskWeekKey,isEditableWeekKey} from './taskBoardRules.js';
import {hasTaskLink} from './taskCompletion.mjs';
export const TASK_WORKFLOW_STAGES=['To do','In progress','Blocked','Ready for review','Reviewed'];
export function taskWorkflowStage(data){return data.reviewed?'Reviewed':data.completed?'Ready for review':['In progress','Blocked'].includes(data.boardStatus)?data.boardStatus:'To do';}
export function taskWorkflowUpdate(data,stage,memberId){
 if(data.memberId!==memberId)throw new Error('Only the task owner can move this task.');
 if(!isEditableWeekKey(taskWeekKey(data)))throw new Error('Older weeks are read-only. Open the current or previous week to move tasks.');
 if(data.reviewed)throw new Error('Reviewed tasks are locked. Reopen them in People view.');
 if(!TASK_WORKFLOW_STAGES.includes(stage)||stage==='Reviewed')throw new Error('Review and approval happen in People view, with a reason.');
 if(stage==='Ready for review'&&!hasTaskLink(data))throw new Error('Add at least one link in People view before completing this task.');
 return {boardStatus:['In progress','Blocked'].includes(stage)?stage:'To do',completed:stage==='Ready for review',updatedAt:Date.now()};
}
