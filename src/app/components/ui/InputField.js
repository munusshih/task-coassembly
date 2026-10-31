"use client";

import DateField from './DateField';

export default function InputField({ className = "", style, onClick, ...props }) {
  if(props.type==='date')return <DateField {...props} className={className} style={style} onClick={onClick}/>;
  const classes = ["field-input", className].filter(Boolean).join(" ");
  return <input className={classes} onClick={onClick} style={{borderRadius:"var(--radius-field)",...style}} {...props} />;
}
