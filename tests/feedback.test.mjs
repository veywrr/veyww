import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diverseMix,identity} from '../web/mix.mjs';
import {snapshot,mergeCollection} from '../web/sync-model.mjs';
const now=Date.now(),run=(tracks,dislikes,likes=[],genres=[])=>diverseMix(tracks,{},likes,genres,'day',10,now,[],{},()=>.5,dislikes);
test('disliked recordings and recognized reuploads never return in wave',()=>{
 const rejected={id:'a',artist:'Artist',title:'Song'};
 const tracks=[rejected,{id:'copy',artist:'Uploader',title:'Artist - Song (slowed + reverb)'},{id:'new',artist:'Other',title:'New'}];
 assert.deepEqual(run(tracks,[rejected]).map(t=>t.id),['new']);
});
test('negative feedback lowers artist and genre priority while keeping alternatives available',()=>{
 const artist={id:'a',artist:'Artist',title:'Fresh',genre:'rock'},other={id:'b',artist:'Other',title:'Fresh',genre:'jazz'};
 assert.equal(run([artist,other],[],[{artist:'Artist'}],['rock'])[0].id,'a');
 assert.equal(run([artist,other],[{id:'old',artist:'Artist',title:'Old',genre:'rock'}],[{artist:'Artist'}],['rock'])[0].id,'b');
 assert.equal(run([artist], [{id:'old',artist:'Artist',title:'Old'}]).length,1);
});
test('dislikes sync across devices and an explicit new like clears a remote rejection',()=>{
 const a={id:'a'},b={id:'b'};
 assert.deepEqual(snapshot({dislikes:[a]}).dislikes,[a]);
 const combined=mergeCollection({}, {dislikes:[a]}, {likes:[a],dislikes:[b]});
 assert.deepEqual(combined.dislikes,[b,a]);assert.deepEqual(combined.likes,[]);
 const restored=mergeCollection({dislikes:[a]}, {likes:[a],dislikes:[]}, {dislikes:[a,b]});
 assert.deepEqual(restored.likes,[a]);assert.deepEqual(restored.dislikes,[b]);
});
