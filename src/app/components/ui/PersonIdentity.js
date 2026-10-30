import MemberAvatar from './MemberAvatar';
export default function PersonIdentity({member,name,label,children}) {
 const person=member||{id:name||'member',data:{name:name||'Member'}};
 return <span className="person-identity"><MemberAvatar member={person} size="inline" onClick={()=>{window.location.href=member?`/members?profile=${member.id}`:'/members';}}/><span>{label&&<small>{label}</small>}<strong>{person.data?.name||name||'Member'}</strong>{children}</span></span>;
}
