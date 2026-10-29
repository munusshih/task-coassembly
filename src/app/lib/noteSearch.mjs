export function searchableText(value, stripHtml = true) {
  const raw = String(value || '');
  return (stripHtml ? raw.replace(/<[^>]*>/g, ' ') : raw).replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, entity => ({'&nbsp;':' ', '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'"})[entity]).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function distance(a, b) {
  const rows = Array.from({length:a.length+1}, () => Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++) rows[i][0]=i;
  for(let j=0;j<=b.length;j++) rows[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}
export function fuzzyMatch(fields, query) {
  const tokens=searchableText(query, false).split(' ').filter(Boolean);
  if(!tokens.length) return {score:0, matchType:null};
  const normalized=Object.entries(fields).map(([type,text])=>({type,text:searchableText(text)}));
  let score=0, matchType=null;
  for(const token of tokens) {
    let best=null;
    for(const field of normalized) {
      const exact=field.text.includes(token);
      const limit=token.length>64?0:token.length>=6?2:token.length>=3?1:0;
      const fuzzy=!exact&&limit&&field.text.split(/[^\p{L}\p{N}/]+/u).some(word=>Math.abs(word.length-token.length)<=limit&&distance(token,word)<=limit);
      if(exact||fuzzy) { const weight=(exact?10:3)+(field.type==='title'?5:0); if(!best||weight>best.weight) best={weight,type:field.type}; }
    }
    if(!best) return null;
    score+=best.weight; matchType ||= best.type;
  }
  return {score,matchType};
}
