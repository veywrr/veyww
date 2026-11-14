import {rankReactions,reaction} from '../web/reactions.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {diverseMix,mergeListening} from '../web/mix.mjs';
const song=(id,artist,extra={})=>({id,artist,title:'Song '+id,plays:200000,...extra});
test('a liked recording stays personal after one dislike of the same artist',()=>{const loved=song('loved','Artist'),pool=[loved,...[1,2,3,4].map(i=>song('fa'+i,'Favorite A')),...[1,2,3,4].map(i=>song('fb'+i,'Favorite B')),...[1,2,3,4,5].map(i=>song('other'+i,'Other '+i,{plays:1000000}))];
 const out=diverseMix(pool,{},[loved,song('fa0','Favorite A'),song('fb0','Favorite B')],[],'day',10,Date.now(),[],{},()=>.5,[song('hated','Artist')]);
 assert.equal(out[0].id,'loved',out.map(t=>t.id).join());});
test('an artist with many likes is not exiled by a single dislike',()=>{const likes=[1,2,3].map(i=>song('l'+i,'Artist')),pool=[song('new','Artist'),...[1,2,3,4,5].map(i=>song('other'+i,'Other '+i,{plays:1000000}))];
 const out=diverseMix(pool,{},likes,[],'day',6,Date.now(),[],{},()=>.5,[song('hated','Artist')]);assert.equal(out[0].id,'new');});
test('replayed tracks move to the end of listening history',()=>{const t=(id,at)=>({id,title:id,artist:'A '+id,at});assert.deepEqual(mergeListening([t('a',1),t('b',2)],[t('a',3)]).map(x=>x.id),['b','a']);});
test('own beta uses timed reaction events to rest an early-skipped recording for a day',()=>{const now=Date.now(),a=song('a','Skipped'),b=song('b','Skipped'),c=song('c','Other');const events=[reaction(a,'skipEarly',{now:now-60000,listened:3})];const out=rankReactions([a,b,c],{events,now,random:()=>0});assert.ok(!out.some(t=>t.id==='a'));assert.equal(out[0].id,'c');assert.ok(rankReactions([a],{events,now:now+2*86400000}).some(t=>t.id==='a'));});

test('the new end of the slider excludes saved and played recordings, including reuploads',()=>{
 const saved=song('saved','Saved Artist'),heard=song('heard','Heard Artist');
 const reupload={...saved,id:'reupload'};
 const unseen=song('unseen','Saved Artist'),discovery=song('fresh','New Artist');
 const pool=[saved,reupload,heard,unseen,discovery];
 const ranked=rankReactions(pool,{saved:[saved],listening:[heard],favorites:[{name:'Saved Artist'}],balance:1,random:()=>0});
 assert.deepEqual(ranked.map(t=>t.id),['fresh','unseen']);
 assert.deepEqual(rankReactions([saved],{saved:[saved],balance:1}),[]);
});
