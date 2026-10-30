'use client';
import {useEffect,useRef,useState} from 'react';
import {MainContainer,ChatContainer,MessageList,Message,MessageInput} from '@chatscope/chat-ui-kit-react';
import HeadingCount from './HeadingCount';
import PersonIdentity from './PersonIdentity';

/** Shared conversation UI. Persistence stays with the caller's existing record. */
export default function DiscussionThread({entries=[],members=[],username,onSend,busy=false,error=''}) {
 const thread=useRef(null);
 useEffect(()=>{const input=thread.current?.querySelector('[contenteditable]'),send=thread.current?.querySelector('.cs-button--send');if(input){input.setAttribute('role','textbox');input.setAttribute('aria-label','Write a thought');input.setAttribute('aria-multiline','true');}send?.setAttribute('aria-label','Send thought');},[]);
 const [value,setValue]=useState(''),[plain,setPlain]=useState('');
 async function send(_html,text){
  const body=String(text||plain).trim();
  if(!body||busy)return;
  if(await onSend(body)){setValue('');setPlain('');}
 }
 return <section ref={thread} className="discussion-thread" aria-label="Thoughts">
  <HeadingCount title="Thoughts" count={entries.length||undefined}/>
  <MainContainer className="discussion-chat"><ChatContainer>
   <MessageList autoScrollToBottomOnMount={false} aria-label="Thoughts messages">
    {!entries.length&&<MessageList.Content><p className="discussion-empty">Start the conversation.</p></MessageList.Content>}
    {entries.map((entry,index)=>{
     const author=entry.authorName||entry.username||entry.author;
     const member=members.find(person=>person.id===entry.authorId||String(person.data?.name||'').toLowerCase()===String(author).toLowerCase());
     return <Message key={entry.id||index} model={{direction:String(author).toLowerCase()===username.toLowerCase()?'outgoing':'incoming',position:'single',type:'custom'}}>
      <Message.Header><PersonIdentity member={member} name={author}/><time dateTime={entry.createdAt?new Date(entry.createdAt).toISOString():undefined}>{entry.createdAt?new Date(entry.createdAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}</time></Message.Header>
      <Message.CustomContent>{entry.body||entry.text}</Message.CustomContent>
     </Message>;
    })}
   </MessageList>
   <MessageInput value={value} onChange={(html,text)=>{setValue(html);setPlain(text);}} onSend={send} placeholder="Write a thought…" attachButton={false} sendDisabled={busy||!plain.trim()} disabled={busy} aria-label="Write a thought"/>
  </ChatContainer></MainContainer>
  <p className="discussion-hint">Enter to send · Shift + Enter for a new line</p>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
