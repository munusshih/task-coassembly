import WorkspaceIllustration from "./WorkspaceIllustration";
export default function WorkspacePageHero({ title, illustration, children, className = "" }) {
  return <div data-rationale-anchor="page-introduction" data-rationale-label="Page introduction" className={`workspace-page-hero ${className}`}>
    <h1 className="task-page-brand"><span>{title}</span>{illustration && <WorkspaceIllustration name={illustration} />}</h1>
    {children}
  </div>;
}
