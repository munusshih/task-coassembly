export function noteImageUrl(value) {
 const raw=String(value||'').trim();
 if(!raw)return '';
 try{const url=new URL(raw);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export function noteCover(data) {
 return noteImageUrl(data?.imageUrl)||noteImageUrl(String(data?.content||'').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]);
}
export function noteExcerpt(data) {
 const text=String(data?.content||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 const title=String(data?.title||'').trim();
 const excerpt=title&&text.startsWith(title)?text.slice(title.length).trim():text;
 return excerpt.length>170?`${excerpt.slice(0,167).trim()}…`:excerpt;
}
