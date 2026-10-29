/** Shared pill action used by timers and task review controls. */
export default function TimeButton({ type = 'button', quiet = false, className = '', ...props }) {
  const classes = ['time-button', quiet && 'time-button--quiet', className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}
