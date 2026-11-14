import {normalizeEffects} from './core.mjs';
export function sharedResume(value,now=Date.now()){
 if(!value||!Number.isFinite(value.at)||value.at<=0||value.at>now+60000)return null;
 const clean=t=>{if(!t?.id||t.source!=='SoundCloud'||!/^https:\/\/(?:www\.)?soundcloud\.com\/[^/?#]+\/[^/?#]+\/?$/.test(t.page||''))return null;return {id:String(t.id).slice(0,300),title:String(t.title||'').slice(0,300),artist:String(t.artist||'').slice(0,200),catalogArtist:Boolean(t.catalogArtist),genre:String(t.genre||'').slice(0,100),source:'SoundCloud',page:t.page,art:/^https:\/\/i[1-4]\.sndcdn\.com\//.test(t.art||'')?t.art:'',duration:Math.max(0,Math.min(86400,Number(t.duration)||0)),url:''};};
 const track=clean(value.track);if(!track)return null;const queue=(Array.isArray(value.queue)?value.queue:[]).slice(0,80).map(clean).filter(Boolean);
 return {track,queue,playback:{shuffle:Boolean(value.playback?.shuffle),repeat:['off','all','one'].includes(value.playback?.repeat)?value.playback.repeat:'off'},at:value.at,position:Math.max(0,Math.min(track.duration||86400,Number(value.position)||0)),wave:Boolean(value.wave),origin:String(value.origin||'').slice(0,100),effects:normalizeEffects(value.effects),locked:Boolean(value.locked),linked:value.linked!==false};
}
export function newestResume(a,b){return (a?.at||0)>=(b?.at||0)?a:b;}
