'use client';
import {useMemo,useSyncExternalStore} from 'react';
import {normalizePreferences,preferenceAttributes,preferenceVariables} from './preferences.mjs';
const KEY='protocol-preferences';
const CHANGE='protocol:preferences';
function snapshot(){try{return window.localStorage.getItem(KEY);}catch{return null;}}
function parse(value){try{return normalizePreferences(JSON.parse(value||'{}'));}catch{return normalizePreferences();}}
function subscribe(listener){
 const storage=event=>{if(event.key===KEY||event.key===null)listener();};
 window.addEventListener(CHANGE,listener);window.addEventListener('storage',storage);
 return()=>{window.removeEventListener(CHANGE,listener);window.removeEventListener('storage',storage);};
}
export function readPreferences(){return parse(snapshot());}
export function usePreferences(){const raw=useSyncExternalStore(subscribe,snapshot,()=>null);return useMemo(()=>parse(raw),[raw]);}
export function applyPreferences(value){
 const root=document.documentElement;
 Object.assign(root.dataset,preferenceAttributes(value));
 Object.entries(preferenceVariables(value)).forEach(([key,v])=>root.style.setProperty(key,v));
}
export function savePreferences(patch){
 const previous=readPreferences();
 const value=normalizePreferences({...previous,...patch,customColors:{...previous.customColors,...patch.customColors}});
 window.localStorage.setItem(KEY,JSON.stringify(value));
 applyPreferences(value);window.dispatchEvent(new Event(CHANGE));return value;
}
export function initializePreferences(){applyPreferences(readPreferences());return subscribe(()=>applyPreferences(readPreferences()));}
