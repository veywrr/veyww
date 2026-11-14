export function newId(){const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}

import {diverseMix,discoveryQuery} from './mix.mjs';

export const defaults=()=>({speed:1,pitch:0,reverb:0,linked:true});

export function normalizeEffects(e={}){const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;const speed=Math.max(.5,Math.min(2,finite(e.speed,1))),linked=e.linked!==false;return {speed,pitch:linked?12*Math.log2(speed):Math.max(-12,Math.min(12,finite(e.pitch,0))),reverb:Math.max(0,Math.min(1,finite(e.reverb,0))),linked};}

export function changeEffect(e,key,value){const next={...e,[key]:value};if(e.linked&&key==='pitch')next.speed=2**(Math.max(-12,Math.min(12,value))/12);return normalizeEffects(next);}

export function nextEffects(state,id){return normalizeEffects({...state.lock?state.effects:(state.trackEffects[id]||defaults()),linked:state.linked!==false});}

export function normalize(t){return {id:'audius:'+t.id,remoteId:t.id,title:t.title,artist:t.user?.name||'Audius',genre:t.genre||'',duration:t.duration||0,art:t.artwork?.['480x480']||'',source:'Audius',url:''};}

export function available(t){return t.is_streamable!==false&&!t.is_stream_gated&&t.is_available!==false;}

export function unique(items){return [...new Map(items.map(t=>[t.id,t])).values()];}

export function recommendSeeds(likes,genres,favorites=[]){return [...new Set([...favorites.map(a=>a.name),...likes.slice(-12).reverse().map(t=>t.artist).filter(Boolean),...genres])].slice(0,24);}

export function buildMix(candidates,history,likes,genres,day,limit=40,now=Date.now(),listening=[],exposure={},dislikes=[]){return diverseMix(candidates,history,likes,genres,day,limit,now,listening,exposure,Math.random,dislikes);}

export function mixRequests(likes,genres,round,day,favorites=[],listening=[],signals=[]){
 const seeds=[...new Map(likes.filter(t=>t.page).slice(-60).reverse().map(t=>[t.page,t])).values()],daily=[...day].reduce((a,c)=>a+c.charCodeAt(0),0),jobs=[];
 if(seeds.length){for(let n=0;n<Math.min(3,seeds.length);n++){const i=(round*Math.min(3,seeds.length)+daily+n)%seeds.length;jobs.push({mode:'related',value:seeds[i].page,offset:(Math.floor((round*Math.min(3,seeds.length)+n)/Math.max(1,seeds.length))%30)*30,relatedTaste:true});}}
 else{const artists=[...new Set([...favorites.map(a=>a.name),...likes.map(t=>t.artist).filter(Boolean)])];for(let n=0;n<Math.min(2,artists.length);n++)jobs.push({mode:'search',value:artists[(round*Math.min(2,artists.length)+daily+n)%artists.length],offset:(Math.floor((round*Math.min(2,artists.length)+n)/Math.max(1,artists.length))%30)*30});}
 const likedGenres=[...new Set(likes.map(t=>String(t.genre||'').trim()).filter(Boolean))],taste=likedGenres.length?likedGenres:genres,explore=round%4===3||signals.filter(e=>e.action==='skipEarly'&&Date.now()-e.at<5*60000).length>=3;
 jobs.push({mode:'search',value:explore?discoveryQuery(genres,round,day):taste[(round+daily)%Math.max(1,taste.length)]||'popular music',offset:(Math.floor(round/Math.max(1,taste.length))%30)*30,discovery:true});
 return [...new Map(jobs.map(j=>[JSON.stringify([j.mode,j.value,j.offset]),j])).values()];
}

export function rank(items,likes,genres,day){const affinity=new Map(),key=s=>String(s||'').toLowerCase();for(const t of likes){if(t.artist)affinity.set(key(t.artist),(affinity.get(key(t.artist))||0)+5);if(t.genre)affinity.set(key(t.genre),(affinity.get(key(t.genre))||0)+2);}for(const g of genres)affinity.set(key(g),(affinity.get(key(g))||0)+3);const hash=s=>[...s].reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),7);const score=t=>(affinity.get(key(t.artist))||0)+(affinity.get(key(t.genre))||0)+hash(t.id+day)%100/100;return unique(items).sort((a,b)=>score(b)-score(a));}

export function parseImport(text,name='Импорт'){let tracks=[];if(text.trim().startsWith('{')||text.trim().startsWith('[')){const j=JSON.parse(text);tracks=Array.isArray(j)?j:(j.tracks||[]);}else if(text.trim().startsWith('#EXTM3U')){let title='';for(const line of text.split(/\r?\n/)){if(line.startsWith('#EXTINF:'))title=line.slice(line.indexOf(',')+1);else if(/^https:\/\//.test(line))tracks.push({title:title||line,url:line});}}else{const rows=parseCSV(text);const header=rows.shift()?.map(x=>x.trim().toLowerCase())||[];const ix=(...keys)=>header.findIndex(h=>keys.includes(h));const ti=ix('title','track name','track','название','name'),ar=ix('artist','artist name','artist names','artist(s)','artist name(s)','artists','исполнитель'),ur=ix('url','stream url','audio url','track uri','track url');if(ti<0)throw Error('В CSV нужен столбец Title или Track name');tracks=rows.filter(r=>r[ti]).map(r=>({title:r[ti],artist:r[ar]||'',url:r[ur]||''}));}return {id:newId(),name,tracks:tracks.slice(0,10000).map((t,i)=>({id:t.id||'import:'+newId(),title:String(t.title||t.name||'Трек'),artist:String(t.artist||''),url:/^https:\/\//.test(t.url||'')&&!/(spotify\.com|music\.yandex\.|soundcloud\.com|(?:music\.)?vk\.(?:com|ru))/.test(t.url)?t.url:'',source:t.source||'Импорт',page:/^https:\/\/(www\.)?soundcloud\.com\//.test(t.page||'')?t.page:'',remoteId:t.remoteId||'',genre:t.genre||'',art:t.art||'',duration:t.duration||0,originUrl:/^https:\/\//.test(t.originUrl||t.url||'')?(t.originUrl||t.url):''}))};}

export function parseCSV(s){const rows=[];let row=[],v='',quoted=false;const delimiter=s.split(/\r?\n/)[0].includes(';')?';':',';for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(v);v='';}else if(c==='\n'&&!quoted){row.push(v.replace(/\r$/,''));rows.push(row);row=[];v='';}else v+=c;}if(v||row.length){row.push(v.replace(/\r$/,''));rows.push(row);}return rows;}

export function parseTrackList(text,name='Перенесённая музыка'){

 if(text.length>5e6)throw Error('Список слишком большой (максимум 5 МБ)');

 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

 if(!lines.length)throw Error('Вставь список: Исполнитель — Название, один трек в строке.');

 const tracks=lines.slice(0,10000).map(line=>{const parts=line.split(/\s+[—–-]\s+/);return {title:parts.length>1?parts.slice(1).join(' — '):line,artist:parts.length>1?parts[0]:''};});

 return {...parseImport(JSON.stringify(tracks),name),warning:'Перенесены названия из текста. Выбери версии в поиске при первом запуске каждого трека.'};

}
