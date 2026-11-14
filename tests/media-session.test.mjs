import {test} from 'node:test';import assert from 'node:assert/strict';import {setupMediaSession} from '../web/media-session.mjs';import island from '../desktop/island-model.cjs';
test('system media buttons route next/previous, pause/play and seeking',()=>{const actions={},calls=[],session={setActionHandler:(k,f)=>{actions[k]=f;},setPositionState:s=>calls.push(s)};const engine={audio:{playbackRate:1.25},resume:()=>calls.push('play'),pause:()=>calls.push('pause'),seek:n=>calls.push(n),state:()=>({position:20,duration:100})};const media=setupMediaSession(engine,{next:()=>calls.push('next'),previous:()=>calls.push('previous')},{session,Metadata:class{constructor(data){Object.assign(this,data);}},origin:'https://veyww.space'});assert.equal(actions.seekbackward,null);assert.equal(actions.seekforward,null);actions.nexttrack();actions.previoustrack();actions.play();actions.pause();actions.seekto({seekTime:50});assert.deepEqual(calls,['next','previous','play','pause',50]);media.track({title:'Song',artist:'Artist',art:'https://i1.sndcdn.com/a.jpg'});assert.equal(session.metadata.artwork[0].src,'https://i1.sndcdn.com/a.jpg');media.state({playing:true,position:120,duration:100});assert.equal(session.playbackState,'playing');assert.equal(calls.at(-1).position,100);media.clear();assert.equal(session.metadata,null);});
test('unsupported system actions never prevent playback setup',()=>{assert.doesNotThrow(()=>setupMediaSession({},{},{session:{setActionHandler(){throw Error('Unsupported');}}}));});
test('desktop bridge accepts only bounded metadata and a fixed command set',()=>{assert.equal(island.allowedCommand('next'),true);assert.equal(island.allowedCommand('execute'),false);const s=island.cleanState({id:'a',title:'a'.repeat(500),art:'file:///C:/secret',playing:'true'},'https://veyww.space');assert.equal(s.title.length,300);assert.equal(s.art,'');assert.equal(s.playing,false);assert.equal(island.cleanState({art:'https://evil.test/x'},'https://veyww.space').art,'');});

test('iOS native playback delegates background pause and resume to Safari',()=>{
 const actions={},session={setActionHandler:(name,fn)=>{actions[name]=fn;}};
 const engine={ios:true,mode:'system',audio:{playbackRate:1}};
 const media=setupMediaSession(engine,{}, {session});
 assert.equal(actions.play,null);
 assert.equal(actions.pause,null);
 media.state({playing:true,duration:100,position:10});
 assert.equal(session.playbackState,'none');
 engine.mode='effects';
 media.state({playing:true,duration:100,position:10});
 assert.equal(typeof actions.play,'function');
 assert.equal(session.playbackState,'playing');
 engine.mode='system';
 media.state({playing:false,duration:100,position:10});
 assert.equal(actions.play,null);
 assert.equal(session.playbackState,'none');
});
