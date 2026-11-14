import {artworkURL} from './artwork-url.mjs';
export function setupMediaSession(engine,controls,{session=globalThis.navigator?.mediaSession,Metadata=globalThis.MediaMetadata,origin=globalThis.location?.origin}={}){
 if(!session||engine.native)return {track(){},state(){},clear(){},diagnostics:()=>({available:false,native:Boolean(engine.native)})};
 const actions={};const handler=(action,fn)=>{try{session.setActionHandler(action,fn);actions[action]=fn?'registered':'disabled';}catch(e){actions[action]=e.name||'unsupported';}};
 let useNativePlayback;
 function configurePlayback(){
  const native=engine.ios===true&&engine.mode!=='effects';
  if(native===useNativePlayback)return;
  useNativePlayback=native;
  // Let WebKit handle play/pause directly when the native audio element owns playback.
  handler('play',native?null:(controls.play||(()=>engine.resume())));
  handler('pause',native?null:(controls.pause||(()=>engine.pause())));
  handler('stop',native?null:(controls.pause||(()=>engine.pause())));
  if(native)try{session.playbackState='none';}catch{}
 }
 configurePlayback();
 handler('previoustrack',controls.previous);handler('nexttrack',controls.next);
 handler('seekto',e=>{if(Number.isFinite(e.seekTime))engine.seek(e.seekTime);});
 handler('seekbackward',null);
 handler('seekforward',null);
 return {
  diagnostics:()=>({available:true,mode:engine.mode||'idle',audioConnected:Boolean(engine.audio.isConnected),context:engine.ctx?.state||'not-created',actions:{...actions}}),
  track(t){if(!Metadata)return;let artwork=[];try{if(/^https:\/\//.test(t.art||'')){const src=new URL(artworkURL(t,origin),origin).href;artwork=[{src}];}}catch{}session.metadata=new Metadata({title:t.title||'Трек',artist:t.artist||'',album:'veyww',artwork});},
  state(s){configurePlayback();if(useNativePlayback)return;try{session.playbackState=s.playing?'playing':'paused';if(session.setPositionState&&s.duration>0)session.setPositionState({duration:s.duration,playbackRate:engine.audio.playbackRate||1,position:Math.min(s.duration,Math.max(0,s.position||0))});}catch{}},
  clear(){try{session.metadata=null;session.playbackState='none';session.setPositionState?.();}catch{}}
 };
}
