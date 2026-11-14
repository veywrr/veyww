import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),catalog=require('../desktop/catalog.cjs');catalog.call=async(mode)=>{assert.equal(mode,'resolve_hls');return {url:'https://cf-hls-media.sndcdn.com/test/playlist.m3u8',hls:true};};const {serve}=require('../desktop/server.cjs');
test('Android HLS endpoint requires account and returns an opaque same-server media URL',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-hls-')),server=await serve(0,{dataDir:dir,requireAccount:true}),base='http://127.0.0.1:'+server.address().port;try{assert.equal((await fetch(base+'/catalog/resolve_hls?value=x')).status,401);const register=await fetch(base+'/account/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({nickname:'native_test',password:'six123'})});assert.equal(register.status,200);const cookie=register.headers.get('set-cookie').split(';')[0];const response=await fetch(base+'/catalog/resolve_hls?value=https%3A%2F%2Fsoundcloud.com%2Fa%2Fb',{headers:{Cookie:cookie}});assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.data.hls,true);assert.match(payload.data.url,/^\/media\/[a-f0-9]+$/);}finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}});

test('blocked recordings get a permanent error and a refresh bypasses the ordinary resolve cache',async t=>{
 const calls=[];
 const catalog=require('../desktop/catalog.cjs');
 const serverModule=require.resolve('../desktop/server.cjs');
 const previous=catalog.call;
 delete require.cache[serverModule];
 catalog.call=async(mode,value,offset)=>{
  calls.push(offset);
  if(value==='blocked')throw Error('[soundcloud] This video is DRM protected');
  return {url:'https://cf-hls-media.sndcdn.com/test/list.m3u8',hls:true};
 };
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resolve-refresh-'));
 const server=await require(serverModule).serve(0,{dataDir:dir});
 t.after(async()=>{
  await new Promise(r=>server.close(r));
  fs.rmSync(dir,{recursive:true,force:true});
  catalog.call=previous;
  delete require.cache[serverModule];
 });
 const base='http://127.0.0.1:'+server.address().port+'/catalog/resolve?value=';
 const blocked=await fetch(base+'blocked');
 assert.equal(blocked.status,422);
 assert.equal((await blocked.json()).code,'TRACK_UNAVAILABLE');
 assert.equal((await fetch(base+'open')).status,200);
 assert.equal((await fetch(base+'open&fresh=1')).status,200);
 assert.deepEqual(calls.slice(0,2),[0,0]);
 assert.ok(calls[2]>0);
 const media=(await (await fetch(base+'open')).json()).data.url;
 const nativeFetch=globalThis.fetch;
 let attempts=0;
 t.mock.method(globalThis,'fetch',(url,options)=>{
  if(!String(url).startsWith('https://cf-hls-media.sndcdn.com/'))return nativeFetch(url,options);
  assert.equal(options.headers.Range,'bytes=0-9');
  attempts++;
  return Promise.resolve(attempts===1?new Response(null,{status:503}):new Response('#EXTM3U\nsegment.aac\n',{headers:{'content-type':'application/vnd.apple.mpegurl'}}));
 });
 const response=await fetch(new URL(media,base),{headers:{Range:'bytes=0-9'}});
 assert.equal(response.status,200);
 assert.match(await response.text(),/\/media\/[a-f0-9]+/);
 assert.equal(attempts,2);
});
