import test from 'node:test';
import assert from 'node:assert/strict';
import {noteImageUrl,noteCover,noteExcerpt} from '../src/app/lib/notePresentation.mjs';
test('note covers accept web images and reject unsafe or malformed URLs',()=>{
 assert.equal(noteImageUrl(' https://example.com/cover.png '),'https://example.com/cover.png');
 for(const url of ['javascript:alert(1)','data:text/html,hi','file:///private/photo.png','broken'])assert.equal(noteImageUrl(url),'');
 assert.equal(noteCover({imageUrl:'https://example.com/cover.jpg',content:'<img src="https://example.com/body.jpg">'}),'https://example.com/cover.jpg');
 assert.equal(noteCover({content:'<p>Hello</p><img src="https://example.com/body.jpg">'}),'https://example.com/body.jpg');
});
test('editorial excerpts keep readable content without repeating the title',()=>{
 assert.equal(noteExcerpt({title:'Meeting',content:'<h1>Meeting</h1><p>Ideas &amp; next steps</p>'}),'Ideas & next steps');
 assert.ok(noteExcerpt({content:'A'.repeat(300)}).length<=170);
});
