// Original Figma SVG exports; the Wishes composition keeps its source positions.
const wishesParts = [
  ['wishes-person',0,0], ['wishes-stone-high',1289.51,452.46],
  ['wishes-motion-high',1138.04,491.21], ['wishes-motion-low',1134.21,604.23],
  ['wishes-stone-low',1257.91,1132.14],
];
export default function WorkspaceIllustration({ name, className = '' }) {
  return <span className={`workspace-hero-illustration workspace-hero-illustration--${name} ${className}`} aria-hidden="true">{name==='wishes-catcher'?<span className="workspace-illustration-composite">{wishesParts.map(([part,left,top])=><img key={part} src={`/illustrations/${part}.svg`} style={{left,top}} alt="" />)}</span>:<img src={`/illustrations/${name}.svg`} alt="" />}</span>;
}
