export const FONT_CHOICES={
 instrument:{label:'Instrument Sans',family:'"Instrument Sans", Arial, sans-serif'},
 assembly:{label:'Assembly',family:'"Assembly", "Instrument Sans", Arial, sans-serif'},
 script:{label:'Assembly Script',family:'"Assembly Script", "Instrument Sans", Arial, sans-serif'},
 typewriter:{label:'Assembly Typewriter',family:'"Assembly Typewriter", "Instrument Sans", Arial, sans-serif'},
 mono:{label:'Assembly Mono',family:'"Assembly Mono", "Instrument Sans", monospace'},
};
export const TYPE_ROLES=[
 {key:'fontHeading',label:'Headings',description:'Page titles and section headings.',choices:['instrument','assembly','script'],sample:'Make room for good work'},
 {key:'fontBody',label:'Text',description:'Writing, forms, and conversations.',choices:['instrument','assembly','typewriter'],sample:'Plan together, keep decisions clear. 把想法變成共同的行動。'},
 {key:'fontLabel',label:'Small labels',description:'Dates, counts, and supporting details.',choices:['instrument','mono'],sample:'PROJECT / OCT 30 / 25 MIN'},
];
export const DEFAULT_TYPOGRAPHY={fontHeading:'assembly',fontBody:'instrument',fontLabel:'mono'};
export const ORIGINAL_TYPOGRAPHY={fontHeading:'instrument',fontBody:'instrument',fontLabel:'instrument'};
export function typographyPreferences(value={}) {
 return Object.fromEntries(TYPE_ROLES.map(role=>[role.key,role.choices.includes(value?.[role.key])?value[role.key]:DEFAULT_TYPOGRAPHY[role.key]]));
}
export function typographyVariables(value={}) {
 const selected=typographyPreferences(value);
 return {'--font-heading':FONT_CHOICES[selected.fontHeading].family,'--font-body':FONT_CHOICES[selected.fontBody].family,'--font-label':FONT_CHOICES[selected.fontLabel].family,'--font-accent':FONT_CHOICES[selected.fontHeading].family};
}
