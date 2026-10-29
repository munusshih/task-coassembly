import CrossIcon from './CrossIcon';

export default function TaskReviewControls({ onReview, onReject }) {
  return <div className="task-review-controls" role="group" aria-label="Review task">
    <button type="button" className="todo-decision-icon" aria-label="Review" title="Review task" onClick={onReview}><span className="task-review-symbol"><img src="/illustrations/review-circle.svg" alt="" /></span></button>
    <button type="button" className="todo-decision-icon" aria-label="Reject" title="Reject task" onClick={onReject}><CrossIcon /></button>
  </div>;
}
