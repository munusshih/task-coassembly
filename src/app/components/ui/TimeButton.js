import Button from '../Button';
/** Timer actions use the same button foundation as the rest of Protocol. */
export default function TimeButton({type='button',quiet=false,className='',...props}) {
 return <Button type={type} variant={quiet?'ghost':'primary'} className={['time-button',quiet&&'time-button--quiet',className].filter(Boolean).join(' ')} {...props}/>;
}
