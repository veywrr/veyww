const {parseLRC}=require('../web/lyrics-model.mjs'),cache=new Map();
async function lyrics(params){const title=String(params.get('title')||'').trim().slice(0,240),artist=String(params.get('artist')||'').trim().slice(0,160),duration=Math.max(0,Math.min(86400,Number(params.get('duration'))||0));if(!title||!artist)return {text:'',lines:[]};const key=JSON.stringify([title,artist,Math.round(duration)]),old=cache.get(key);if(old&&Date.now()-old.at<3600000)return old.value;
 const q=new URLSearchParams({track_name:title,artist_name:artist});if(duration)q.set('duration',String(duration));
 try{const r=await fetch('https://lrclib.net/api/get?'+q,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'veyww/0.14.1 (personal music player)'}});if(!r.ok)return {text:'',lines:[]};const j=await r.json(),lines=parseLRC(j.syncedLyrics),text=String(j.plainLyrics||lines.map(x=>x.text).join('\n')).slice(0,60000),value={text,lines,instrumental:j.instrumental===true};cache.set(key,{at:Date.now(),value});while(cache.size>100)cache.delete(cache.keys().next().value);return value;}catch{return {text:'',lines:[]};}
}
module.exports={lyrics};
