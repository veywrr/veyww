async function loadArtwork(session,url,origin,fetcher=fetch){
 const u=new URL(url),direct=u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&/^i[1-4]\.sndcdn\.com$/.test(u.hostname);if(!direct&&(u.origin!==origin||u.pathname!=='/artwork'))throw Error('Invalid artwork endpoint');
 let headers={};if(!direct){const cookies=await session.cookies.get({url:origin}),cookie=cookies.filter(x=>['music_session','music_guest'].includes(x.name)).map(x=>x.name+'='+x.value).join('; ');if(cookie)headers.Cookie=cookie;}
 const response=await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(16000)});
 if(!response.ok)throw Error('Artwork unavailable');const type=(response.headers.get('content-type')||'').split(';')[0];
 if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Invalid artwork type');
 const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>3*1024*1024)throw Error('Artwork too large');parts.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});}const bytes=Buffer.concat(parts);
 return 'data:'+type+';base64,'+bytes.toString('base64');
}
module.exports={loadArtwork};
