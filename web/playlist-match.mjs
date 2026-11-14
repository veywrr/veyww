const clean=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const version=s=>new Set([['slow',/slowed|slowed down|замедл/i],['fast',/sped|speed up|ускор/i],['reverb',/reverb|реверб/i],['remix',/remix|ремикс/i],['live',/\blive\b|концерт/i],['instrumental',/instrumental|инструментал/i],['cover',/\bcover\b|кавер/i]].filter(([,pattern])=>pattern.test(s)).map(([name])=>name));
function words(s){return new Set(clean(s).split(' ').filter(Boolean));}
function overlap(a,b){const left=words(a),right=words(b);if(!left.size||!right.size)return 0;let shared=0;for(const word of left)if(right.has(word))shared++;return 2*shared/(left.size+right.size);}
function titleOnly(title,artist){let s=clean(String(title||'').replace(/\([^)]*\b(?:prod\.?|official|lyrics|audio|video)\b[^)]*\)/gi,'')),a=clean(artist);if(a&&s.startsWith(a+' '))s=s.slice(a.length+1);return s.replace(/\b(?:slowed down|sped up|speed up)\b/gi,' ').replace(/\b(?:slowed|sped|reverb|remix|live|instrumental|cover|official|audio|video|lyrics|hq|hd|original mix)\b/gi,' ').replace(/\s+/g,' ').trim();}
const artistName=s=>clean(s).replace(/\b(?:official|music|records|soundcloud)\b/g,'').trim();
export const importQuery=t=>[t.artist,t.title].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
export function matchScore(original,candidate){
 if(!candidate?.page||candidate.source!=='SoundCloud')return 0;
 const wanted=version(original.title),offered=version(candidate.title);
 for(const tag of new Set([...wanted,...offered]))if(wanted.has(tag)!==offered.has(tag))return 0;
 const artist=clean(String(original.artist||'').split(/,|\s+feat\.?\s+|\s+ft\.?\s+/i)[0]);
 const artistScore=Math.max(overlap(artistName(artist),artistName(candidate.artist)),artist&&(' '+clean(candidate.title)+' ').includes(' '+artist+' ')?1:0);
 const titleScore=overlap(titleOnly(original.title,original.artist),titleOnly(candidate.title,artist));
 if(titleScore<.78||artistScore<.7)return 0;
 const a=Number(original.duration)||0,b=Number(candidate.duration)||0;
 if(a&&b&&Math.abs(a-b)>Math.max(18,a*.14))return 0;
 return titleScore*75+artistScore*20+(a&&b?5:0);
}
export function rankedMatches(original,candidates){return candidates.map(track=>({track,score:matchScore(original,track)})).filter(x=>x.score>=82).sort((a,b)=>b.score-a.score).map(x=>x.track);}
export async function matchImportedTrack(original,{search,resolve}){
 if(original.page||original.url)return {...original};
 let candidates=rankedMatches(original,await search(importQuery(original)));
 if(!candidates.length){const simpler=[String(original.artist||'').split(/,|\s+(?:feat\.?|ft\.?)\s+/i)[0],String(original.title||'').replace(/\([^)]*\b(?:official|audio|video|lyrics|prod\.?)\b[^)]*\)/gi,'')].filter(Boolean).join(' ').trim();if(simpler!==importQuery(original))candidates=rankedMatches(original,await search(simpler));}
 for(const candidate of candidates.slice(0,3)){
  try{const stream=await resolve(candidate);if(!stream?.url)continue;return {...candidate,...(stream.track||{}),title:original.title||candidate.title,artist:original.artist||candidate.artist,url:'',originUrl:original.originUrl||'',addedAt:original.addedAt||0};}
  catch(error){if(!/ограничен|подписк|нет открытого|недоступен автор|private|premium|drm|not available|no video formats|нет.*поток/i.test(error.message||''))throw error;}
 }
 return null;
}
export function createMatchSession({search,resolve}){
 const searches=new Map(),streams=new Map();
 const cached=(map,key,action)=>{if(!map.has(key)){const job=Promise.resolve().then(action).catch(error=>{map.delete(key);throw error;});map.set(key,job);}return map.get(key);};
 return {search:q=>cached(searches,q.toLowerCase(),()=>search(q)),resolve:t=>cached(streams,t.page||t.id,()=>resolve(t))};
}
export async function matchPlaylist(tracks,{session,previous=[],concurrency=3,onProgress=()=>{},cancelled=()=>false}){
 const results=tracks.map((track,index)=>previous[index]?.status==='matched'||previous[index]?.status==='missing'?previous[index]:null);let cursor=0,done=results.filter(Boolean).length;
 async function worker(){while(cursor<tracks.length&&!cancelled()){const index=cursor++;if(results[index])continue;try{const track=await matchImportedTrack(tracks[index],session);results[index]={status:track?'matched':'missing',track:track||tracks[index]};}catch(error){results[index]={status:'error',track:tracks[index],message:error.message};}if(cancelled())return;onProgress({index,result:results[index],done:++done,total:tracks.length});}}
 await Promise.all(Array.from({length:Math.max(1,Math.min(3,concurrency))},worker));return results;
}
