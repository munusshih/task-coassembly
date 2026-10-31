"use client";
import {useLayoutEffect,useRef} from 'react';
export default function ProtocolLogo({markOnly=false,className=""}) {
 const image=useRef(null);
 useLayoutEffect(()=>{for(const animation of image.current?.getAnimations()||[])animation.startTime=0;},[]);
 return <span className={`protocol-brand${markOnly?' protocol-brand--mark':''}${className?` ${className}`:''}`} aria-label={markOnly?undefined:'Protocol'}><img ref={image} src="/icon.svg" alt=""/>{!markOnly&&<span>Protocol</span>}</span>;
}
