export default function WorkspaceViewPicker({ value, onChange, options, label = 'Page grouping' }) {
  return <label className="task-view-picker workspace-view-picker"><span>by</span><select className="task-view-selector" aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
