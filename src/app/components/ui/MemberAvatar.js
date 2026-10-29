"use client";
import { useState } from 'react';

export default function MemberAvatar({ member, onClick }) {
  const [failed, setFailed] = useState(false);
  const name = member.data?.name || member.id;
  const knownPhoto = { mor: '/portraits/mor.webp', munus: '/portraits/munus.webp', tzu: '/portraits/tzu.webp' }[name.trim().toLowerCase()];
  const photo = member.data?.photoURL || member.data?.avatarUrl || knownPhoto;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toUpperCase();
  return <button type="button" className="member-avatar" onClick={onClick} aria-label={`View ${name} profile`}>
    {photo && !failed ? <img src={photo} alt="" onError={() => setFailed(true)} /> : <span aria-hidden="true">{initials}</span>}
  </button>;
}
