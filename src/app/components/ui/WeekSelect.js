import SelectField from './SelectField';

export default function WeekSelect({ children, ...props }) {
  return <span className="workspace-week-select"><SelectField {...props} className="week-select">{children}</SelectField><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></span>;
}
