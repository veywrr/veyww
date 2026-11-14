import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diverseMix,identity,listenRecord} from '../web/mix.mjs';
const now=Date.UTC(2026,9,26),day=86400000;
const track=(id,artist=id,title='Song')=>({id,artist,title,genre:'rock'});
const mix=(items,history={},listening=[],exposure={},random=()=>.5)=>diverseMix(items,history,[],[],'same-day',40,now,listening,exposure,random);
test('new random draws change the order on the same day without changing tracks',()=>{
 const tracks=Array.from({length:20},(_,i)=>track(String(i)));
 let i=0;const a=mix(tracks,{},[],{},()=>i++/20);
 i=20;const b=mix(tracks,{},[],{},()=>--i/20);
 assert.notDeepEqual(a.map(t=>t.id),b.map(t=>t.id));
 assert.deepEqual(new Set(a.map(t=>t.id)),new Set(b.map(t=>t.id)));
 assert.ok(a.every(t=>!('_random' in t)&&!('_identity' in t)));
});
test('played tracks and recognized reuploads stay out during the first six hours',()=>{
 const original=track('original','Artist','Title');
 const reupload=track('reupload','Uploader','Artist - Title (slowed + reverb)');
 const history={old:now-3600000,expired:now-31*day};
 const out=mix([original,reupload,track('old'),track('expired'),track('fresh')],history,[listenRecord(original,now-3600000)]);
 assert.deepEqual(new Set(out.map(t=>t.id)),new Set(['expired','fresh']));
});
test('shown tracks stay out during the first six hours and return after thirty-six',()=>{
 const a=track('a'),b=track('b'),c=track('c');
 const out=mix([a,b,c],{},[],{[identity(a).key]:now-3600000,[identity(b).key]:now-8*day});
 assert.deepEqual(new Set(out.map(t=>t.id)),new Set(['b','c']));
});
test('randomness preserves duplicate protection and artist alternation',()=>{
 const tracks=[track('a1','A','one'),track('a2','A','two'),track('b1','B','one'),track('b2','B','two'),track('copy','A','one')];
 const out=mix(tracks);
 assert.equal(out.length,4);
 for(let i=1;i<out.length;i++)assert.notEqual(out[i].artist,out[i-1].artist);
});
