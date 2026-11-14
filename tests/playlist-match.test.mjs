import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchScore,rankedMatches,matchImportedTrack} from '../web/playlist-match.mjs';
import {sortTracks} from '../web/sort.mjs';
const original={id:'y1',title:'Liverpool Street In The Rain',artist:'Mall Grab',duration:332,originUrl:'https://music.yandex.ru/track/1'};
const candidate={id:'s1',source:'SoundCloud',title:'Liverpool Street In The Rain',artist:'Mall Grab',duration:332,page:'https://soundcloud.com/mallgrab/song'};
test('matching prefers same artist/title and rejects another artist or a very different duration',()=>{
 assert.ok(matchScore(original,candidate)>=95);
 assert.equal(matchScore(original,{...candidate,artist:'Other Artist'}),0);
 assert.equal(matchScore(original,{...candidate,duration:100}),0);
 assert.equal(rankedMatches(original,[{...candidate,artist:'Other'},candidate])[0].id,'s1');
});
test('matching preserves slowed/remix intent and does not strip real song names Up or Down',()=>{
 assert.equal(matchScore(original,{...candidate,title:original.title+' (slowed)'}),0);
 assert.ok(matchScore({...original,title:original.title+' (slowed)'},{...candidate,title:original.title+' (slowed)'})>90);
 assert.ok(matchScore({...original,title:'Down'},{...candidate,title:'Down'})>90);
});
test('a matched import stores the playable page and original service link without temporary stream URLs',async()=>{
 const result=await matchImportedTrack(original,{search:async()=>[candidate],resolve:async()=>({url:'/media/temporary',track:candidate})});
 assert.equal(result.page,candidate.page);assert.equal(result.originUrl,original.originUrl);assert.equal(result.url,'');assert.equal(original.page,undefined);
});
test('missing matches return null while network errors remain distinguishable from absent tracks',async()=>{
 assert.equal(await matchImportedTrack(original,{search:async()=>[],resolve:async()=>{throw Error('should not run');}}),null);
 await assert.rejects(matchImportedTrack(original,{search:async()=>{throw Error('network failure');},resolve:async()=>({})}),/network/);
});
test('restricted candidates are skipped and existing resolved playlist entries remain usable',async()=>{
 assert.equal(await matchImportedTrack(original,{search:async()=>[candidate],resolve:async()=>{throw Error('Трек ограничен автором или подпиской');}}),null);
 assert.equal((await matchImportedTrack({...candidate,addedAt:123},{search:async()=>{throw Error('unexpected');}})).addedAt,123);
});
test('track sorting supports names and dates without mutating stored playback order',()=>{
 const tracks=[{id:'a',title:'Я',addedAt:10},{id:'b',title:'А',addedAt:20}];
 assert.deepEqual(sortTracks(tracks,'title-asc').map(t=>t.id),['b','a']);
 assert.deepEqual(sortTracks(tracks,'title-desc').map(t=>t.id),['a','b']);
 assert.deepEqual(sortTracks(tracks,'date-desc').map(t=>t.id),['b','a']);
 assert.deepEqual(sortTracks(tracks,'date-asc').map(t=>t.id),['a','b']);
 assert.deepEqual(tracks.map(t=>t.id),['a','b']);
});
