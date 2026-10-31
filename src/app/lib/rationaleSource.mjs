// A normal Markdown citation keeps references compatible with the existing body schema.
export function splitRationaleSource(body='') {
 const match=String(body).match(/\n\n\[Bylaw source\]\((https:\/\/bylaws\.coassembly\.work\/[^\s)]*)\)\s*$/);
 return {body:match?body.slice(0,match.index):body,sourceUrl:match?.[1]||''};
}
export function withRationaleSource(body,url='') {
 const content=splitRationaleSource(body).body;
 if(!url.trim())return content;
 let parsed;try{parsed=new URL(url);}catch{throw new Error('Enter a valid bylaw link.');}
 if(parsed.protocol!=='https:'||parsed.hostname!=='bylaws.coassembly.work'||parsed.username||parsed.password||/[\s)]/.test(url))throw new Error('Use an HTTPS link from bylaws.coassembly.work.');
 return `${content}\n\n[Bylaw source](${parsed.href})`;
}
