import {warmAudio} from './warm-stream.mjs';
import {genreCatalog} from './preferences.mjs';
import {searchScore,searchQueries,rankSearch} from './search-model.mjs';
let artistHints=genreCatalog.flatMap(g=>g.artists);export function setArtistHints(artists){artistHints=[...new Set([...genreCatalog.flatMap(g=>g.artists),...artists.map(a=>a.name)])];}
let serial=0;const pending=new Map(),cache=new Map(),inflight=new Map();
try{localStorage.removeItem('catalog-cache-v4');}catch{}
window.providerReply=(id,payload)=>{const w=pending.get(id);if(!w)return;pending.delete(id);clearTimeout(w.timer);payload.error?w.reject(Error(payload.error)):w.resolve(payload.data);};
async function request(mode,value,offset,fresh=false){if(window.Android&&location.hostname!=='veyww.space')return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Сервис не ответил вовремя'));},65000);pending.set(id,{resolve,reject,timer});window.Android.catalog(id,mode,value,offset);});const resolving=mode.startsWith('resolve'),signal=resolving?AbortSignal.timeout(25000):null;let r,j;for(let attempt=0;attempt<(resolving?2:3);attempt++){try{r=await fetch('/catalog/'+mode+'?value='+encodeURIComponent(value)+'&offset='+offset+(fresh?'&fresh=1':''),{signal:resolving&&attempt===0?AbortSignal.any([signal,AbortSignal.timeout(12000)]):signal||AbortSignal.timeout(20000)});j=await r.json().catch(()=>({error:'Музыкальный сервер вернул неверный ответ. Попробуй ещё раз.'}));}catch(error){if(attempt>=1||signal?.aborted){if(resolving&&['TimeoutError','AbortError'].includes(error.name))throw Object.assign(Error('Сервер долго готовит аудио. Попробуй включить трек ещё раз.'),{code:'CATALOG_TIMEOUT'});throw error;}await new Promise(resolve=>setTimeout(resolve,500));continue;}if(![429,502,503,504].includes(r.status)||attempt===(resolving?1:2))break;await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));}if(!r?.ok||j?.error)throw Object.assign(Error(j?.error||'Источник не отвечает'),{status:r?.status,code:j?.code});if(window.Android&&j.data?.url?.startsWith('/media/'))j.data.url=new URL(j.data.url,location.origin).href;return j.data;}
export function api(mode,value,offset=0){const key=JSON.stringify([mode,value,offset]),hit=cache.get(key),ttl=mode.startsWith('resolve')?240000:600000;if(hit&&Date.now()-hit.time<ttl)return Promise.resolve(hit.data);if(inflight.has(key))return inflight.get(key);const job=request(mode,value,offset).then(data=>{cache.set(key,{time:Date.now(),data});if(cache.size>80)cache.delete(cache.keys().next().value);return data;}).finally(()=>inflight.delete(key));inflight.set(key,job);return job;}
const searchPages=new Map();
export async function search(q,offset=0,signal){
 if(signal?.aborted)throw new DOMException('Отменено','AbortError');const queries=searchQueries(q,artistHints);if(!queries.length)return [];
 const cacheKey=String(q).trim().toLowerCase();let effective=offset?(searchPages.get(cacheKey)||queries[0]):queries[0],tracks=await api('search',effective,offset);
 let best=Math.max(0,...tracks.map(t=>searchScore(t,q)));
 if(offset===0&&(tracks.length<5||best<25))for(const other of queries.slice(1,3)){
  if(signal?.aborted)throw new DOMException('Отменено','AbortError');try{const extra=await api('search',other,0),score=Math.max(0,...extra.map(t=>searchScore(t,other)));tracks=[...tracks,...extra];if(score>best&&extra.length){best=score;effective=other;}}catch{}
  if(tracks.length>=10)break;
 }
 if(offset===0){searchPages.set(cacheKey,effective);if(searchPages.size>50)searchPages.delete(searchPages.keys().next().value);}return rankSearch(tracks,q,queries);
}
export function trending(seed,offset=0){return search(seed||'cult member',offset);}
export function artists(query,offset=0){return api('artists',query,offset);}
export function artist(page,offset=0){return api('artist',page,offset);}
export function related(page,offset=0){return api('related',page,offset);}
export async function stream(track,{fresh=false}={}){if(track.source!=='SoundCloud')return track.url;if(!track.page)throw Error('У трека нет ссылки на источник');const mode=window.Android?.serverAudioVersion?.()>=1&&location.hostname==='veyww.space'?'resolve_hls':'resolve';if(!fresh)return api(mode,track.page);
const key=JSON.stringify([mode,track.page,0]);
cache.delete(key);
if(window.Android&&location.hostname!=='veyww.space')return api(mode,track.page);
const info=await request(mode,track.page,0,true);
cache.set(key,{time:Date.now(),data:info});
return info;}
// A resolved next track can start inside the native ended event, without awaiting a request.
export function cachedStream(track){if(track.source!=='SoundCloud')return track.url;const mode=window.Android?.serverAudioVersion?.()>=1&&location.hostname==='veyww.space'?'resolve_hls':'resolve',hit=cache.get(JSON.stringify([mode,track.page,0]));return hit&&Date.now()-hit.time<240000?hit.data:null;}
let prefetchQueue=[],prefetching=false;
export function prefetch(tracks,{warm=true}={}){prefetchQueue=tracks.filter(t=>t.source==='SoundCloud'&&t.page).slice(0,2).map(track=>({track,warm}));if(!prefetching)drainPrefetch();}
async function drainPrefetch(){prefetching=true;try{while(prefetchQueue.length){const {track,warm}=prefetchQueue.shift();await stream(track).then(info=>warm?warmAudio(info):null).catch(()=>{});}}finally{prefetching=false;}}
