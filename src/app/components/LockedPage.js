import TabPage from './ui/TabPage';
import WorkspacePageHero from './ui/WorkspacePageHero';
import LockIcon from './ui/LockIcon';
export default function LockedPage({title}) { return <TabPage title={title} className="locked-page" header={<WorkspacePageHero title={title} />}><section className="workspace-locked-state"><LockIcon/><h2>We’re still putting this together.</h2><p>{title} is locked for now. We’ll open it when it’s ready.</p></section></TabPage>; }
