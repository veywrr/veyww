import {test} from 'node:test';import assert from 'node:assert/strict';import {Engine} from '../web/audio.mjs';
test('a delayed stream recovery cannot override a user pause or a newer track',async()=>{
 const keys=['window','navigator','document','Audio'],saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 class Audio{constructor(){this.paused=true;this.currentTime=0;this.duration=120;this.playbackRate=1;}setAttribute(){}canPlayType(){return 'maybe';}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}addEventListener(){}}
 try{for(const [key,value]of Object.entries({window:{},navigator:{userAgent:'Windows',platform:'Win32'},document:{body:{append(){}}},Audio}))Object.defineProperty(globalThis,key,{value,configurable:true});
  const engine=new Engine(()=>{},()=>{},()=>{}),effects={speed:1,pitch:0,reverb:0,linked:true};await engine.play({id:'old'},'https://test/old',effects);let resolve;engine.refreshStream=()=>new Promise(r=>resolve=r);const retry=engine.recover();engine.pause();resolve({url:'https://test/retry'});await retry;assert.equal(engine.audio.paused,true);assert.equal(engine.audio.src,'https://test/old');
  engine.resume();const retry2=engine.recover();engine.stopForSwitch();await engine.play({id:'new'},'https://test/new',effects);resolve({url:'https://test/obsolete'});await retry2;assert.equal(engine.audio.src,'https://test/new');assert.equal(engine.currentTrack.id,'new');engine.pause();
 }finally{for(const key of keys)if(saved[key])Object.defineProperty(globalThis,key,saved[key]);else delete globalThis[key];}
});

test('repeated waiting events do not postpone a retry on the existing audio stream',async t=>{
 const scheduled=[];
 t.mock.method(globalThis,'setTimeout',(callback,delay)=>{
  const timer={callback,delay};
  scheduled.push(timer);
  return timer;
 });
 const audio={currentTime:0,ended:false,play:t.mock.fn(async()=>{})};
 const engine=Object.assign(Object.create(Engine.prototype),{
  audio,wanted:true,currentTrack:{id:'song'},token:1,recover:t.mock.fn(),
 });
 engine.watchStall();
 engine.watchStall();
 assert.equal(scheduled.length,1);
 assert.equal(scheduled[0].delay,4500);
 scheduled[0].callback();
 assert.equal(audio.play.mock.callCount(),1);
 assert.equal(engine.recover.mock.callCount(),0);
 assert.equal(scheduled.length,2);
 assert.equal(scheduled[1].delay,12000);
 scheduled[1].callback();
 assert.equal(engine.recover.mock.callCount(),1);
});
