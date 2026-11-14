import {test} from 'node:test';import assert from 'node:assert/strict';import {mergeCollection,snapshot} from '../web/sync-model.mjs';
test('two devices retain independent likes while a removed like stays removed',()=>{const a={id:'a'},b={id:'b'},c={id:'c'},base={likes:[a]},local={likes:[b]},remote={likes:[a,c]};assert.deepEqual(mergeCollection(base,local,remote).likes,[c,b]);});
test('concurrent playlist additions merge and local removal does not restore remote tracks',()=>{const base={playlists:[{id:'p',name:'First',tracks:[{id:'a'}]}]},local={playlists:[{id:'p',name:'New name',tracks:[{id:'b'}]}]},remote={playlists:[{id:'p',name:'First',tracks:[{id:'a'},{id:'c'}]}]};const next=mergeCollection(base,local,remote);assert.equal(next.playlists[0].name,'New name');assert.deepEqual(next.playlists[0].tracks.map(t=>t.id),['c','b']);});
test('unchanged stale preferences do not overwrite new remote preferences',()=>{const base={genres:['phonk'],profile:{name:'Old'}},remote={genres:['house'],profile:{name:'New'}};const next=mergeCollection(base,base,remote);assert.deepEqual(next.genres,['house']);assert.deepEqual(next.profile,{name:'New'});});
test('changes made during an upload survive its acknowledgement',()=>{const draft={likes:[{id:'a'}]},current={likes:[{id:'b'}]},ack={likes:[{id:'a'},{id:'c'}]};assert.deepEqual(mergeCollection(draft,current,ack).likes.map(t=>t.id),['c','b']);});
test('device audio files and playback settings are not sent to account storage',()=>{const c=snapshot({library:[{url:'blob:private'}],volume:.2,effects:{pitch:3},likes:[]});assert.equal(c.library,undefined);assert.equal(c.effects,undefined);assert.equal(c.volume,undefined);});
test('acknowledged history converges to server canonical records instead of uploading forever',()=>{const original={listening:[{id:'a',title:'Song',at:123,extra:'local-only'}]},remote={listening:[{id:'a',title:'Song',at:123}]};assert.deepEqual(mergeCollection(original,original,remote),snapshot(remote));});

test('merging playlist edits preserves the cover and concurrent track additions', async()=>{
 const {mergeCollection}=await import('../web/sync-model.mjs');
 const old={id:'playlist',name:'Original',tracks:[],cover:'old'};
 const base={playlists:[old]};
 const local={playlists:[{...old,name:'Renamed',cover:'new'}]};
 const remote={playlists:[{...old,tracks:[{id:'added'}]}]};
 assert.deepEqual(mergeCollection(base,local,remote).playlists,[{...old,name:'Renamed',cover:'new',tracks:[{id:'added'}]}]);
});

test('a missing date from one device cannot erase the recorded like date',()=>{
 const track={id:'a',title:'Old name',addedAt:100};
 const base={likes:[track]};
 const remote={likes:[{id:'a',title:'New name',addedAt:0}]};
 assert.deepEqual(mergeCollection(base,base,remote).likes,[{id:'a',title:'New name',addedAt:100}]);
});

test('a remote re-like date survives a concurrent metadata edit',()=>{
 const track={id:'a',title:'Old name',addedAt:100};
 const base={likes:[track]};
 const local={likes:[{...track,title:'Edited name'}]};
 const remote={likes:[{...track,addedAt:300}]};
 assert.deepEqual(mergeCollection(base,local,remote).likes,[{id:'a',title:'Edited name',addedAt:300}]);
});

test('recover a missing date only from the matching like event and keep removals',()=>{
 const signal=(id,action,at)=>({eventId:String(at),action,at,track:{id}});
 const local={likes:[{id:'a'},{id:'b'}],signals:[signal('a','like',123),signal('a','complete',456),signal('b','complete',789)]};
 assert.deepEqual(mergeCollection({},local,{}).likes,[{id:'a',addedAt:123},{id:'b'}]);
 assert.deepEqual(mergeCollection(local,{...local,likes:[]},local).likes,[]);
});
