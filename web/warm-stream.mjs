const warmed=new Map();
export async function warmAudio(info,{origin=location.origin,fetcher=fetch,connection=navigator.connection}={}){
 if(!info?.hls||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType))return;
 const safe=value=>{const u=new URL(value,origin);if(u.origin!==origin||!u.pathname.startsWith('/media/'))throw Error('Unexpected media URL');return u.href;};
 let key;try{key=safe(info.url);if(Date.now()-(warmed.get(key)||0)<120000)return;warmed.set(key,Date.now());while(warmed.size>8)warmed.delete(warmed.keys().next().value);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{
  let url=key,entries=[];for(let depth=0;depth<3;depth++){const r=await fetcher(url,{signal:controller.signal,cache:'force-cache'});if(!r.ok)throw Error();const text=await r.text();if(!text.startsWith('#EXTM3U'))throw Error();entries=text.split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')).map(s=>safe(new URL(s,url).href));if(!text.includes('#EXT-X-STREAM-INF'))break;url=entries[0];}
  let total=0;for(const segment of entries.slice(0,2)){const r=await fetcher(segment,{signal:controller.signal,cache:'force-cache'});if(!r.ok)break;const reader=r.body?.getReader();if(!reader)break;try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>1024*1024){controller.abort();return;}}}finally{await reader.cancel().catch(()=>{});}}
 }finally{clearTimeout(timer);}
 }catch{if(key)warmed.delete(key);}
}
