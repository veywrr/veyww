import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mixRequests,buildMix} from '../web/core.mjs';
import {identity} from '../web/mix.mjs';

for(const count of [1,2,3,5,12])test(`refresh advances every repeated related seed (${count} likes)`,()=>{
 const likes=Array.from({length:count},(_,i)=>({page:'https://soundcloud.com/a/track'+i})),seen=new Set();
 for(let round=0;round<12;round++)for(const job of mixRequests(likes,[],round,'2026-10-30').filter(j=>j.mode==='related')){
  const key=job.value+':'+job.offset;assert.ok(!seen.has(key),key);seen.add(key);
 }
});
test('cold start advances artist pages instead of returning a cached page again',()=>{
 const seen=new Set(),favorites=['A','B','C','D','E'].map(name=>({name}));
 for(let round=0;round<10;round++)for(const j of mixRequests([],[],round,'day',favorites).filter(j=>!j.discovery)){
  const key=j.value+':'+j.offset;assert.ok(!seen.has(key),key);seen.add(key);
 }
});
test('consecutive refreshes do not recycle queued recordings even when uploads change ids',()=>{
 const exposure={},now=Date.now(),pool=Array.from({length:100},(_,i)=>({id:String(i),title:'Track '+i,artist:'Artist '+(i%20)}));
 const first=buildMix(pool,{},[],[],'day',30,now,[],exposure);
 for(const t of first)exposure[identity(t).key]=now;
 const next=buildMix(pool.map(t=>({...t,id:'reupload:'+t.id})),{},[],[],'day',30,now+1,[],exposure);
 assert.equal(next.length,30);assert.ok(next.every(t=>!first.some(a=>identity(a).key===identity(t).key)));
});
