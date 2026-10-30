export function searchableText(value,stripHtml=true) {
 return String(value||'').replace(stripHtml?/<[^>]*>/g:/$^/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().toLowerCase();
}
export function fuzzyMatch(fields,query) {
 const term=searchableText(query,false);
 if(!term)return {score:0,matchType:null};
 for(const [type,value] of Object.entries(fields)) {
  const text=String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
  const index=text.toLowerCase().indexOf(term);
  if(index>=0)return {score:type==='title'?15:10,matchType:type,matchText:text.slice(Math.max(0,index-40),index+term.length+80),matchQuery:query.trim()};
 }
 return null;
}
