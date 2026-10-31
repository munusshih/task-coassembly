'use client';
import SelectField from './SelectField';
import WeekPicker from './WeekPicker';
export default function WeekSelect({children,weekPicker=false,onChange,value,...props}) {
 if(weekPicker)return <WeekPicker {...props} value={value} onChange={week=>onChange?.({target:{value:week}})}/>;
 return <span className="workspace-week-select"><SelectField {...props} value={value} onChange={onChange} chevron={false} className="week-select">{children}</SelectField><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span>;
}
