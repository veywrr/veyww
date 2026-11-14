import {discoverySlot,artistBlocked} from './discovery-model.mjs';
import {recording,uniqueRecordings} from './wave-identity.mjs';
import {identity,fold} from './mix.mjs';
export const reactionWeights={like:1,complete:.5,playlist:.8,replay:.8,skipEarly:-.7,skipLate:-.1,dislike:-1,end:0,error:0,qualified:0};
export function genreKey(value){return fold(value).replace(/drum (?:and )?bass|dnb/g,'drum bass').replace(/hip hop|hiphop|хип хоп/g,'hip hop').replace(/witchhouse/g,'witch house');}
export function sanitizeSignals(items=[],now=Date.now()){
 if(!Array.isArray(items))return [];
 return items.filter(x=>x&&typeof x==='object'&&typeof x.eventId==='string'&&x.eventId.length<=100&&Object.hasOwn(reactionWeights,x.action)&&Number.isFinite(x.at)&&x.at>0&&x.at<=now+60000).slice(-3000).map(x=>({eventId:x.eventId,session:String(x.session||'').slice(0,100),action:x.action,at:x.at,listened:Math.max(0,Math.min(86400,Number(x.listened)||0)),position:Math.max(0,Math.min(86400,Number(x.position)||0)),track:{id:String(x.track?.id||'').slice(0,300),title:String(x.track?.title||'').slice(0,300),artist:String(x.track?.artist||'').slice(0,200),genre:String(x.track?.genre||'').slice(0,100),page:/^https:\/\/(?:www\.)?soundcloud\.com\//.test(x.track?.page||'')?x.track.page:'',duration:Math.max(0,Math.min(86400,Number(x.track?.duration)||0))}})).filter(x=>x.track.id);
}
export function mergeSignals(...lists){return sanitizeSignals([...new Map(lists.flat().map(e=>[e.eventId,e])).values()].sort((a,b)=>a.at-b.at));}
export function reaction(track,action,{session='',listened=0,position=0,now=Date.now()}={}){return sanitizeSignals([{eventId:crypto.randomUUID(),session,action,at:now,listened,position,track}],now)[0];}
export class ListeningSession{
 constructor(emit,clock=()=>Date.now()){this.emit=emit;this.clock=clock;this.reset();}
 reset(){this.track=null;this.listened=0;this.position=0;this.wall=0;this.playing=false;this.session=crypto.randomUUID();}
 begin(track){this.track=track;this.stalledAt=0;this.interruptionUntil=0;this.listened=0;this.position=0;this.wall=this.clock();this.playing=false;this.session=crypto.randomUUID();}
 update(track,state){if(!this.track||this.track.id!==track?.id)return;const now=this.clock();if(state.buffering){this.stalledAt||=now;}else if(this.stalledAt){if(now-this.stalledAt>=3000)this.interruptionUntil=now+10000;this.stalledAt=0;}const position=Number(state.position)||0,elapsed=(now-this.wall)/1000,delta=position-this.position,rate=Number(state.rate)||1;if(this.playing&&state.playing&&elapsed>0&&elapsed<5&&delta>0&&delta<=elapsed*Math.max(2.2,rate+1)+.5)this.listened+=Math.min(elapsed,delta/rate);this.wall=now;this.position=position;this.playing=Boolean(state.playing);}
 action(action,track=this.track){if(track)this.emit(reaction(track,action,{session:this.session,listened:this.listened,position:this.position}));}
 finish(reason='skip'){if(!this.track)return;const action=reason==='error'||reason==='skip'&&(this.stalledAt&&this.clock()-this.stalledAt>=3000||this.clock()<this.interruptionUntil)?'error':reason==='skip'&&this.listened<.2?'end':reason==='ended'?(this.listened>=Math.min(30,(this.track.duration||60)*.5)?'complete':'end'):this.listened<30?'skipEarly':'skipLate';this.action(action);this.track=null;}
}
function taste(events,now){const artists=new Map(),genres=new Map(),tracks=new Map();for(const e of events){const weight=(reactionWeights[e.action]||0)*Math.exp(-(now-e.at)/(21*86400000)),id=identity(e.track),g=genreKey(e.track.genre);artists.set(id.artist,(artists.get(id.artist)||0)+weight);if(g)genres.set(g,(genres.get(g)||0)+weight);tracks.set(id.key,(tracks.get(id.key)||0)+weight);}return {artists,genres,tracks};}
export function rankReactions(candidates,{events=[],likes=[],favorites=[],genres=[],dislikes=[],now=Date.now(),random=Math.random,limit=120,recent=[],balance=.5,blockedArtists=[],saved=[],listening=[]}={}){
 const log=sanitizeSignals(events,now),pref=taste(log,now),liked=new Set(likes.map(t=>identity(t).key)),known=new Set([...likes.map(t=>identity(t).artist),...favorites.map(t=>fold(t.name))]),preferred=new Set(genres.map(genreKey)),rejected=new Set(dislikes.map(t=>identity(t).key)),recentSkips=new Set(log.filter(e=>e.action==='skipEarly'&&now-e.at<86400000).map(e=>identity(e.track).key));
 const savedKeys=new Set([...saved,...likes].map(t=>identity(t).key)),heard=new Set(listening.map(t=>t.key||identity(t).key));
 const last=log.at(-1),direction=last&&['skipEarly','dislike'].includes(last.action)&&now-last.at<20*60000?{artist:identity(last.track).artist,genre:genreKey(last.track.genre)}:null;
 const pool=uniqueRecordings(candidates,recent).filter(t=>!artistBlocked(t,blockedArtists)&&!rejected.has(identity(t).key)&&!recentSkips.has(identity(t).key)).map(t=>{const id=identity(t),g=genreKey(t.genre),personal=liked.has(id.key)||t.relatedTaste===true||!likes.length&&known.has(id.artist),discovery=!known.has(id.artist)&&!savedKeys.has(id.key)&&!heard.has(id.key);let score=(liked.has(id.key)?8:t.relatedTaste===true?6:known.has(id.artist)?1:0)+Math.max(-4,Math.min(2,(pref.artists.get(id.artist)||0)*.6))+(pref.genres.get(g)||0)*1.3+(preferred.has(g)?1.5:0)+Math.min(5,Math.log10(1+(Number(t.plays)||0)))+random();if(direction){if(id.artist===direction.artist)score-=7;if(g&&g===direction.genre)score-=2;}return {t,id,g,personal,discovery,familiar:savedKeys.has(id.key)||heard.has(id.key),similar:t.relatedTaste===true,score};});
 if(balance>=.9){const fresh=pool.filter(x=>!x.familiar);pool.splice(0,pool.length,...fresh);}
 const result=[],recentArtists=recent.slice(-11).map(t=>recording(t).artist),counts=new Map();let previous=recentArtists.at(-1)||'';
 while(pool.length&&result.length<limit){
  const window=recentArtists.slice(-11),allowed=x=>x.id.artist!==previous&&window.filter(a=>a===x.id.artist).length<3&&(counts.get(x.id.artist)||0)<Math.max(2,Math.ceil(limit*.12));
  const eligible=pool.filter(allowed);if(!eligible.length)break;
  const slot=discoverySlot(result.length,balance),fits=x=>slot==='familiar'?x.familiar:slot==='similar'?x.similar||x.personal:x.discovery&&!x.familiar,hasSlot=eligible.some(fits);let best=-1,bestScore=-Infinity;
  for(let i=0;i<pool.length;i++){const x=pool[i];if(!allowed(x))continue;let score=x.score-(counts.get(x.id.artist)||0)*3;if(hasSlot&&!fits(x))score-=100;if(score>bestScore){best=i;bestScore=score;}}
  if(best<0)break;const [x]=pool.splice(best,1);result.push(x.t);previous=x.id.artist;recentArtists.push(previous);counts.set(previous,(counts.get(previous)||0)+1);
 }return result;
}
