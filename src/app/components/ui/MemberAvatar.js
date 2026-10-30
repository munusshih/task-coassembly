"use client";
import {useEffect,useState} from 'react';
export function MemberAvatarImage({member,className=''}) {
 const [failed,setFailed]=useState(false);
 const name=member.data?.name||member.id||'Member';
 const knownPhoto={mor:'/portraits/mor.webp',munus:'/portraits/munus.webp',tzu:'/portraits/tzu.webp'}[name.trim().toLowerCase()];
 const photo=member.data?.photoURL||member.data?.avatarUrl||knownPhoto;
 useEffect(()=>setFailed(false),[photo]);
 const icons=['walking-person','approve-person','compose-member','book-carrier','wishes-person','task-maker'];
 const illustration=icons[Array.from(member.id||name).reduce((sum,ch)=>sum+ch.codePointAt(0),0)%icons.length];
 return photo&&!failed?<img className={className} src={photo} alt="" onError={()=>setFailed(true)}/>:<img className={`member-avatar-illustration ${className}`} src={`/illustrations/${illustration}.svg`} alt=""/>;
}
export default function MemberAvatar({member,onClick,size='profile'}) {
 const name=member.data?.name||member.id;
 return <button type="button" className={`member-avatar member-avatar--${size}`} onClick={onClick} aria-label={`View ${name} profile`}><MemberAvatarImage member={member}/></button>;
}
