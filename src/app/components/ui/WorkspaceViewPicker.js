export default function WorkspaceViewPicker({ value, onChange, options, label = 'Page grouping', prefix = 'by' }) {
  return <label className="task-view-picker workspace-view-picker"><span>{prefix}</span><select className="task-view-selector" aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
