import {roomImpulse,reverbLevels} from './reverb.mjs';
export function usesSystemAudio(e={},ios=false){return !(Number(e.reverb)>0)&&!(e.linked===false&&Math.abs(Number(e.pitch)||0)>.001);}
export class Engine {
 constructor(onState,onEnd,onError){
  this.native=window.Android;this.ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  this.onState=onState;this.onEnd=onEnd;this.onError=onError;this.audio=this.makeAudio();this.directAudio=this.audio;this.processedAudio=null;this.token=0;this.pauseGeneration=0;this.wanted=false;this.recoveryAttempts=0;
  const reconnect=()=>{if(this.wanted&&!this.unlocking&&this.currentTrack){this.hls?.startLoad();if(this.mode!=='system')this.ctx?.resume().catch(()=>{});if(this.audio.paused&&!this.audio.ended)this.audio.play().then(()=>this.watchStall()).catch(()=>{});else this.watchStall();}};document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')reconnect();});window.addEventListener?.('online',reconnect);
  if(this.native)window.nativeState=s=>{this.lastNative=s;onState(s);if(s.ended)onEnd();if(s.error)onError(s.error);};
 }
 makeAudio(){const audio=new Audio();audio.crossOrigin='anonymous';audio.preload='auto';audio.setAttribute('playsinline','');audio.hidden=true;document.body.append(audio);
  const update=()=>{if(this.audio===audio&&!this.unlocking)this.onState(this.state());};
  audio.ontimeupdate=audio.onplay=audio.onloadedmetadata=audio.onratechange=update;
  audio.onpause=()=>{if(this.audio===audio&&audio.paused&&this.currentTrack&&!this.unlocking&&!audio.ended&&audio.readyState>=2&&!audio.error){this.wanted=false;this.pauseGeneration++;this.clearStallWatch();}update();};
  audio.onended=()=>{if(this.audio===audio&&!this.unlocking&&this.wanted){this.wanted=false;this.clearStallWatch();this.onEnd();}};
  audio.onwaiting=audio.onstalled=()=>{if(this.audio===audio){this.watchStall();this.onState(this.state());}};
  audio.onplaying=()=>{if(this.audio===audio&&!audio.paused&&!this.unlocking&&this.currentTrack){this.wanted=true;this.watchStall();this.onState(this.state());}};
  audio.onerror=()=>{if(this.audio===audio&&!this.unlocking&&this.wanted)this.recover();};return audio;
 }
 unlock(){
  if(this.native)return;try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
  if(!this.ios){const Context=window.AudioContext||window.webkitAudioContext;if(Context){this.ctx||=new Context();this.ctx.resume().catch(()=>{});}}
  if(!this.primed&&!this.audio.currentSrc){this.primed=true;this.unlocking=true;const data=new Uint8Array(46),v=new DataView(data.buffer),text=(at,s)=>[...s].forEach((c,i)=>data[at+i]=c.charCodeAt(0));text(0,'RIFF');v.setUint32(4,38,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,48000,true);v.setUint32(28,96000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,2,true);const url=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));this.primeUrl=url;this.audio.src=url;this.audio.play().then(()=>{if(this.audio.src===url)this.audio.pause();}).catch(()=>{});}
 }
 async init(force=false){if(this.native||this.ios&&!force)return;if(!this.initializing)this.initializing=this.buildGraph();try{return await this.initializing;}catch(e){this.initializing=null;throw e;}}
 async buildGraph(){
  const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Для обработки звука нужен современный браузер');this.ctx||=new Context();this.processedAudio||=this.makeAudio();
  if(this.ctx.audioWorklet){const {SoundTouchNode}=await import('./vendor/soundtouch.js');await SoundTouchNode.register(this.ctx,'./vendor/soundtouch-processor.js');this.pitch=new SoundTouchNode({context:this.ctx});}
  this.input=this.ctx.createMediaElementSource(this.processedAudio);this.bus=this.ctx.createGain();this.dry=this.ctx.createGain();this.wet=this.ctx.createGain();this.convolver=this.ctx.createConvolver();
  this.convolver.normalize=false;this.convolver.buffer=roomImpulse(this.ctx);
  const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-3;limiter.ratio.value=12;this.bus.connect(this.dry).connect(limiter);this.reverbLow=this.ctx.createBiquadFilter();this.reverbLow.type='lowpass';this.reverbLow.frequency.value=4200;this.reverbLow.Q.value=.5;this.reverbHigh=this.ctx.createBiquadFilter();this.reverbHigh.type='highpass';this.reverbHigh.frequency.value=140;this.reverbHigh.Q.value=.5;this.bus.connect(this.convolver).connect(this.reverbHigh).connect(this.reverbLow).connect(this.wet).connect(limiter);this.master=this.ctx.createGain();this.master.gain.value=this.volume??1;limiter.connect(this.master).connect(this.ctx.destination);if(this.waveAnalyser){this.master.connect(this.waveAnalyser);this.waveMasterConnected=true;}
 }
 async play(track,stream,effects,options={}){
  const token=++this.token,info=typeof stream==='string'?{url:stream}:stream;this.clearStallWatch();this.wanted=!options.paused;if(!options.recovering){this.recoveryAttempts=0;this.recovering=false;this.stallNudged=false;}
  if(this.native){this.native.play(JSON.stringify({...track,url:info.url,hls:info.hls,...effects}));return;}
  const direct=usesSystemAudio(effects,this.ios);if(!direct)await this.init(true);if(token!==this.token)return;
  const target=direct?this.directAudio:this.processedAudio,previous=this.audio;this.audio=target;if(previous!==target){previous.pause();previous.removeAttribute('src');previous.load();}
  if(direct){if(this.directSource)await this.ctx.resume();else if(this.ctx?.state==='running'){if(this.ios)this.ctx.suspend().catch(()=>{});else await this.ctx.suspend();}}else await this.ctx.resume();if(token!==this.token)return;
  this.currentTrack=track;this.streamInfo=info;this.effects=effects;this.mode=direct?'system':'effects';this.unlocking=false;
  if(this.primeUrl){URL.revokeObjectURL(this.primeUrl);this.primeUrl=null;}this.hls?.destroy();this.hls=null;
  if(info.hls&&!target.canPlayType('application/vnd.apple.mpegurl')){const {default:Hls}=await import('./vendor/hls.mjs');if(token!==this.token)return;if(!Hls.isSupported())throw Error('Плеер не поддерживает HLS');this.hls=new Hls({enableWorker:true,maxBufferLength:180,maxMaxBufferLength:300,maxBufferSize:24*1024*1024,backBufferLength:20});this.hls.on(Hls.Events.ERROR,(_,d)=>{if(token===this.token&&d.fatal)this.recover();});this.hls.loadSource(info.url);this.hls.attachMedia(target);}else target.src=info.url;
  this.applyEffects(effects);
  if(options.position>0)target.addEventListener('loadedmetadata',()=>{if(token===this.token&&Number.isFinite(target.duration))target.currentTime=Math.min(options.position,Math.max(0,target.duration-.1));},{once:true});
  if(this.wanted){const playing=target.play();this.watchStall();try{await playing;}catch(error){if(token!==this.token||!this.wanted)return;throw error;}if(token!==this.token)return;this.watchStall();}else this.onState(this.state());
 }
 applyEffects(e){
  const direct=this.mode==='system';this.audio.preservesPitch=direct&&e.linked===false;this.audio.webkitPreservesPitch=direct&&e.linked===false;this.audio.playbackRate=e.speed;
  if(direct){this.audio.volume=this.volume??1;return;}
  if(this.bus){const linked=!this.pitch||e.linked!==false;if(this.routeLinked!==linked){this.input.disconnect();this.pitch?.disconnect();if(linked)this.input.connect(this.bus);else{this.input.connect(this.pitch);this.pitch.connect(this.bus);}this.routeLinked=linked;}if(!linked){this.pitch.playbackRate.value=e.speed;this.pitch.pitchSemitones.value=e.pitch;}const levels=reverbLevels(e.reverb,this.ios);this.wet.gain.setTargetAtTime(levels.wet,this.ctx.currentTime,.14);this.dry.gain.setTargetAtTime(levels.dry,this.ctx.currentTime,.14);}
 }
 setEffects(e){if(this.native){this.native.effects(JSON.stringify(e));return;}const direct=usesSystemAudio(e,this.ios);if(this.currentTrack&&direct!==(this.mode==='system')){const s=this.state();return this.play(this.currentTrack,this.streamInfo,e,{position:s.position,paused:!s.playing}).catch(error=>this.onError(error.message));}this.effects=e;this.applyEffects(e);}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.native)this.native.volume(this.volume);else{if(this.mode==='system')this.audio.volume=this.volume;if(this.master)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.02);}}
 enableWaveAnalysis(){
  // Keep Safari ordinary playback on native audio, preserving its background behaviour.
  if(this.native||!this.currentTrack||this.ios&&this.mode!=='effects')return;
  try{const Context=window.AudioContext||window.webkitAudioContext;this.ctx||=new Context();
   if(!this.waveAnalyser){this.waveAnalyser=this.ctx.createAnalyser();this.waveAnalyser.fftSize=256;this.waveAnalyser.smoothingTimeConstant=.85;this.waveData=new Uint8Array(256);}
   if(this.master&&!this.waveMasterConnected){this.master.connect(this.waveAnalyser);this.waveMasterConnected=true;}
   if(this.mode==='system'&&!this.ios&&!this.directSource){this.directSource=this.ctx.createMediaElementSource(this.directAudio);this.directSource.connect(this.ctx.destination);this.directSource.connect(this.waveAnalyser);}
   this.ctx.resume().catch(()=>{});
  }catch{}
 }
 waveSamples(){if(!this.waveAnalyser||this.ctx?.state!=='running'||this.ios&&this.mode!=='effects')return null;this.waveAnalyser.getByteTimeDomainData(this.waveData);return this.waveData;}
 clearStallWatch(){clearTimeout(this.stallTimer);this.stallTimer=null;}
 watchStall(){
  if(this.stallTimer||!this.wanted||this.unlocking||!this.currentTrack)return;
  const token=this.token,audio=this.audio,position=audio.currentTime;
  const timeout=this.stallNudged?12000:position>0?7500:4500;
  this.stallTimer=setTimeout(()=>{
   this.stallTimer=null;
   if(token!==this.token||!this.wanted||audio.ended)return;
   if(audio.currentTime>position+.2){
    this.recoveryAttempts=0;this.stallNudged=false;this.watchStall();return;
   }
   if(!this.stallNudged&&!audio.error){
    // Try the same play request first, keeping the stream and playback position.
    this.stallNudged=true;
    // Keep an in-flight segment alive while the server retries upstream.
    if(this.mode==='effects')this.ctx?.resume().catch(()=>{});
    audio.play().catch(error=>{
     if(token===this.token&&this.wanted&&error.name!=='AbortError')this.recover();
    });
    this.watchStall();
   }else this.recover();
  },timeout);
  this.stallTimer?.unref?.();
 }
 async recover(){if(this.recovering||!this.wanted||!this.currentTrack)return;this.clearStallWatch();if(this.recoveryAttempts>=3){this.pause();this.onState(this.state());this.onError('Поток прервался. Проверь соединение и нажми воспроизведение.');return;}const token=this.token,pauseGeneration=this.pauseGeneration,position=this.audio.currentTime,track=this.currentTrack,effects=this.effects;this.recoveryAttempts++;this.recovering=true;
  try{const stream=this.refreshStream?await this.refreshStream(track):this.streamInfo;if(token!==this.token||pauseGeneration!==this.pauseGeneration||!this.wanted)return;const playback=this.play(track,stream,effects,{position,recovering:true});this.recovering=false;await playback;}catch(error){if(this.currentTrack===track&&pauseGeneration===this.pauseGeneration&&this.wanted){if(error.code==='TRACK_UNAVAILABLE'){this.pause();this.onState(this.state());this.onError(error.message);}else this.watchStall();}}finally{if(token===this.token)this.recovering=false;}
 }
 stopForSwitch(){this.currentTrack=null;this.streamInfo=null;this.wanted=false;this.token++;this.recovering=false;this.clearStallWatch();if(this.native){this.pause();return;}this.audio.pause();this.hls?.destroy();this.hls=null;this.audio.removeAttribute('src');this.audio.load();}
 resume(){this.wanted=true;this.recoveryAttempts=0;if(this.native){if(!this.lastNative?.playing)this.native.toggle();return;}if(!this.currentTrack)return;if(this.mode!=='system')this.ctx?.resume().catch(()=>{});if(this.audio.error){this.recover();return;}const token=this.token;this.audio.play().then(()=>this.watchStall()).catch(e=>{if(token!==this.token||!this.wanted)return;if(e.name==='NotAllowedError'){this.wanted=false;this.onError('Открой плеер и нажми воспроизведение');}else this.recover();});this.watchStall();}
 pause(){this.wanted=false;this.pauseGeneration++;this.clearStallWatch();if(this.native){if(this.lastNative?.playing)this.native.toggle();return;}this.audio.pause();}
 toggle(){if(this.native)this.native.toggle();else if(this.audio.paused)this.resume();else this.pause();}
 seek(t){if(this.native)this.native.seek(t);else if(Number.isFinite(this.audio.duration))this.audio.currentTime=Math.max(0,Math.min(this.audio.duration,t));}
 bufferedAhead(){try{const t=this.audio.currentTime,b=this.audio.buffered;for(let i=0;i<b.length;i++)if(b.start(i)<=t&&b.end(i)>=t)return b.end(i)-t;}catch{}return 0;}
 state(){if(this.native)return this.lastNative||{playing:false,position:0,duration:0};return {playing:!this.audio.paused,buffering:Boolean(this.wanted&&!this.audio.ended&&this.audio.readyState<3),position:this.audio.currentTime,duration:Number.isFinite(this.audio.duration)?this.audio.duration:0};}
}
