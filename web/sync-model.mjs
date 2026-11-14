import {sharedResume,newestResume} from './resume-model.mjs';
import {mergeSignals} from './reactions.mjs';
import {sanitizeStats,mergeStats} from './profile-model.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
function equal(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;if(Array.isArray(a))return a.length===b.length&&a.every((value,i)=>equal(value,b[i]));const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));}
export function snapshot(s){return copy({resume:sharedResume(s.cloudResume??s.resume),signals:mergeSignals(s.signals||[]),stats:sanitizeStats(s.stats),likes:s.likes||[],dislikes:s.dislikes||[],playlists:s.playlists||[],profile:s.profile||{name:'',setupComplete:false},genres:s.genres||[],favoriteArtists:s.favoriteArtists||[],history:s.history||{},listening:s.listening||[]});}
function mergeItems(base,local,remote,key=x=>x.id,merge){const b=new Map(base.map(x=>[key(x),x])),l=new Map(local.map(x=>[key(x),x])),r=new Map(remote.map(x=>[key(x),x]));for(const id of b.keys())if(!l.has(id))r.delete(id);for(const [id,item]of l)if(!equal(item,b.get(id)))r.set(id,merge&&b.has(id)&&r.has(id)?merge(b.get(id),item,r.get(id)):item);return [...r.values()];}
const likeDate=track=>{
 const value=Number(track?.addedAt);
 return Number.isFinite(value)&&value>0?value:0;
};
function mergeLikes(base,local,remote,signals){
 const dates=tracks=>new Map(tracks.map(track=>[track.id,likeDate(track)]));
 const original=dates(base),left=dates(local),right=dates(remote),fromSignals=new Map();
 for(const signal of signals){
  if(signal.action==='like')fromSignals.set(signal.track.id,Math.max(signal.at,fromSignals.get(signal.track.id)||0));
 }
 return mergeItems(base,local,remote).map(track=>{
  const id=track.id,previous=original.get(id)||0,a=left.get(id)||0,b=right.get(id)||0;
  // Changes to other track fields must not replace a date saved by another device.
  const addedAt=Math.max(a!==previous?a:0,b!==previous?b:0)||a||b||previous||fromSignals.get(id);
  return addedAt&&likeDate(track)!==addedAt?{...track,addedAt}:track;
 });
}
export function mergeCollection(base,local,remote){base=snapshot(base);local=snapshot(local);remote=snapshot(remote);const signals=mergeSignals(local.signals,remote.signals);const newlyLiked=new Set(local.likes.filter(t=>!base.likes.some(b=>b.id===t.id)).map(t=>t.id)),dislikes=mergeItems(base.dislikes,local.dislikes,remote.dislikes).filter(t=>!newlyLiked.has(t.id)),rejected=new Set(dislikes.map(t=>t.id));return {resume:newestResume(local.resume,remote.resume),signals,stats:mergeStats(local.stats,remote.stats),likes:mergeLikes(base.likes,local.likes,remote.likes,signals).filter(t=>!rejected.has(t.id)),dislikes,playlists:mergeItems(base.playlists,local.playlists,remote.playlists,x=>x.id,(b,l,r)=>({...r,name:l.name!==b.name?l.name:r.name,cover:(l.cover||'')!==(b.cover||'')?l.cover:r.cover,tracks:mergeItems(b.tracks||[],l.tracks||[],r.tracks||[])})),profile:equal(local.profile,base.profile)?remote.profile:local.profile,genres:mergeItems(base.genres,local.genres,remote.genres,x=>x),favoriteArtists:mergeItems(base.favoriteArtists,local.favoriteArtists,remote.favoriteArtists,x=>x.name.toLowerCase()),history:Object.fromEntries([...new Set([...Object.keys(local.history),...Object.keys(remote.history)])].map(id=>[id,Math.max(local.history[id]||0,remote.history[id]||0)]).sort((a,b)=>b[1]-a[1]).slice(0,1200)),listening:mergeItems(base.listening,local.listening,remote.listening).sort((a,b)=>a.at-b.at).slice(-1200)};}
export const sameCollection=equal;
