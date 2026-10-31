import TimePanel from './TimePanel';
/** Automatic and Focus share the exact dial/control layout. */
export default function ClockTimePanel({dial,legend,children,...props}) {
 return <TimePanel {...props}>{legend}<div className="time-panel-dial">{dial}</div><div className="time-panel-controls">{children}</div></TimePanel>;
}
