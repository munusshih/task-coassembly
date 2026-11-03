import {DEFAULT_TYPOGRAPHY, typographyPreferences, typographyVariables} from './typography.mjs';

export const PALETTES = {
 original: {project:'#e9e0f1', worked:'#e2ecdc', planned:'#eeebdf', date:'#f6e5d9'},
 garden: {project:'#dbe7ce', worked:'#d4e6df', planned:'#f0e3c7', date:'#edd6c9'},
 dusk: {project:'#e1dced', worked:'#d5e4ed', planned:'#eee0ce', date:'#f0d8df'},
};
export const COLOR_ROLES = ['project','worked','planned','date'];
export const DEFAULT_PREFERENCES = {
 ...DEFAULT_TYPOGRAPHY, reduceMotion:false, compact:false, focusMinutes:25,
 focusMode:'countdown', textSize:'standard', contrast:false, palette:'original',
 customColors:PALETTES.original, editorMode:'write', noteGuides:true, readingWidth:'comfortable',
};
const oneOf=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
export function normalizePreferences(input={}) {
 const value=input && typeof input==='object' && !Array.isArray(input)?input:{};
 const minutes=Number(value.focusMinutes);
 return {
  ...typographyPreferences(value),
  reduceMotion:value.reduceMotion===true, compact:value.compact===true, contrast:value.contrast===true,
  focusMinutes:Number.isInteger(minutes)&&minutes>=1&&minutes<=240?minutes:25,
  focusMode:oneOf(value.focusMode,['countdown','stopwatch'],'countdown'),
  textSize:oneOf(value.textSize,['standard','large','larger'],'standard'),
  palette:oneOf(value.palette,['original','garden','dusk','custom'],'original'),
  customColors:Object.fromEntries(COLOR_ROLES.map(key=>[key,/^#[\da-f]{6}$/i.test(value.customColors?.[key])?value.customColors[key].toLowerCase():PALETTES.original[key]])),
  editorMode:oneOf(value.editorMode,['write','split','preview'],'write'),
  noteGuides:value.noteGuides!==false,
  readingWidth:oneOf(value.readingWidth,['comfortable','wide'],'comfortable'),
 };
}
export function paletteColors(value) {
 const preferences=normalizePreferences(value);
 return preferences.palette==='custom'?preferences.customColors:PALETTES[preferences.palette];
}
export function foregroundFor(hex) {
 const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 return luminance>.179?'#000000':'#ffffff';
}
export function preferenceVariables(input) {
 const value=normalizePreferences(input), colors=paletteColors(value);
 return {
  ...typographyVariables(value),
  ...Object.fromEntries(COLOR_ROLES.flatMap(key=>[[`--palette-${key}`,colors[key]],[`--on-${key}`,foregroundFor(colors[key])]])),
  '--cover-2':value.palette==='garden'?'#cbdca9':value.palette==='dusk'?'#e1c4d7':value.palette==='custom'?colors.worked:'#e0dc7b',
  '--cover-4':value.palette==='garden'?'#b3cfc9':value.palette==='dusk'?'#bfc4e2':value.palette==='custom'?colors.project:'#c3bbdf',
  '--note-reading-width':value.readingWidth==='wide'?'1040px':'780px',
  '--workspace-grid-gap':value.compact?'16px':'28px',
  '--workspace-item-space':value.compact?'6px':'12px',
 };
}
export function preferenceAttributes(input) {
 const value=normalizePreferences(input);
 return {motion:value.reduceMotion?'reduced':'system',density:value.compact?'compact':'comfortable',textSize:value.textSize,contrast:value.contrast?'high':'standard',noteGuides:value.noteGuides?'on':'off'};
}
