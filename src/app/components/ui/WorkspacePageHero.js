export default function WorkspacePageHero({ title, illustration, children, className = "" }) {
  return <div className={`workspace-page-hero ${className}`}>
    <h1 className="task-page-brand"><span>{title}</span>{illustration && <span className={`workspace-hero-illustration workspace-hero-illustration--${illustration}`} aria-hidden="true"><img src={`/illustrations/${illustration}.svg`} alt="" /></span>}</h1>
    {children}
  </div>;
}
