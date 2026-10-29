'use client';
import {useEffect,useState} from 'react';
export default function RationaleAnchorOverlay({active,selectedKey}) {
 const [targets,setTargets]=useState([]);
 useEffect(()=>{
  if(!active){setTargets([]);return;}
  const update=()=>setTargets([...document.querySelectorAll('[data-rationale-anchor]')].filter(el=>el.dataset.rationaleAnchor!=='page-content').map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.rationaleAnchor,label:el.dataset.rationaleLabel||el.dataset.rationaleAnchor,left:r.left,top:r.top,width:r.width,height:r.height};}).filter(r=>r.width>40&&r.height>20&&r.top<window.innerHeight&&r.top+r.height>64));
  update();window.addEventListener('scroll',update,true);window.addEventListener('resize',update);return()=>{window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);};
 },[active]);
 if(!active)return null;
 return <div className="rationale-anchor-canvas" aria-hidden="true"><div className="rationale-anchor-canvas-label">DROP ON A BLUE AREA TO ATTACH</div>{targets.map(target=><div key={target.id} className={`rationale-anchor-zone${target.id===selectedKey?' rationale-anchor-zone--selected':''}`} style={{left:target.left,top:Math.max(64,target.top),width:target.width,height:Math.max(24,target.height-(target.top<64?64-target.top:0))}}><span>{target.label}</span></div>)}</div>;
}
