import {alphabeticLabel} from './alphabeticLabel.mjs';
export default function LetterBadge({index,quiet=false,className=''}){return <span className={`letter-badge${quiet?' letter-badge--quiet':''} ${className}`}>{alphabeticLabel(index)}</span>;}
