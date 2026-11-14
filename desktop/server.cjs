const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises'),{setTimeout:delay}=require('node:timers/promises');
const {call}=require('./catalog.cjs'),{createPool,clientAddress}=require('./request-pool.cjs');
const media=new Map(),mediaURLs=new Map();
function allowed(url){try{const u=new URL(url);return u.protocol==='https:'&&['sndcdn.com','soundcloud.cloud'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
function register(url){if(!allowed(url))throw Error('Неожиданный адрес аудиопотока');const now=Date.now(),previous=mediaURLs.get(url);if(previous&&media.has(previous)){const item=media.get(previous);if(now-item.time<7200000)return '/media/'+previous;media.delete(previous);}const id=crypto.randomBytes(18).toString('hex');media.set(id,{url,time:now});mediaURLs.set(url,id);while(media.size>12000){const key=media.keys().next().value,item=media.get(key);media.delete(key);if(mediaURLs.get(item.url)===key)mediaURLs.delete(item.url);}return '/media/'+id;}
async function upstream(url,range,signal){
 for(let redirects=0;redirects<5;redirects++){
  if(!allowed(url))throw Error('Адрес потока отклонён');
  let response;
  for(let attempt=0;attempt<2;attempt++){
   const headersDeadline=new AbortController(),timer=setTimeout(()=>headersDeadline.abort(),8000);
   try{
    response=await fetch(url,{redirect:'manual',headers:range?{Range:range}:{},signal:AbortSignal.any([signal,headersDeadline.signal,AbortSignal.timeout(25000)])});
   }catch(error){if(signal.aborted||attempt)throw error;}
   finally{clearTimeout(timer);}
   if(response&&(![408,429,500,502,503,504].includes(response.status)||attempt))break;
   await response?.body?.cancel().catch(()=>{});
   await delay(250,undefined,{signal});
  }
  if(response.status>=300&&response.status<400){
   url=new URL(response.headers.get('location'),url).href;
   await response.body?.cancel();
   continue;
  }
  return response;
 }
 throw Error('Слишком много перенаправлений');
}
function json(res,status,data){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(status===429?{'Retry-After':'2'}:{})});res.end(JSON.stringify(data));}
function serve(port=0,options={}){return new Promise((resolve,reject)=>{
 const root=path.resolve(__dirname,'../web'),trustProxy=options.trustProxy===true||process.env.MUSIC_TRUST_PROXY==='1';
 const accounts=require('./accounts.cjs').createAccounts({dataDir:options.dataDir,trustProxy,mailTransport:options.mailTransport,publicOrigin:options.publicOrigin}),schedule=createPool(call);
 const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');if(!require('./access.cjs').gate(req,res,u,options.accessToken,options.secureCookie!==false))return;
 if(options.offline&&await options.offline(req,res,u))return;
 if(u.pathname==='/download/windows'&&['GET','HEAD'].includes(req.method)){
  const installer=path.resolve(__dirname,'../../windows-installers/veyww-Windows-Setup.exe');
  let info;try{info=await fs.promises.stat(installer);}catch{}
  if(!info?.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':info.size,'Content-Disposition':'attachment; filename="veyww-Windows-Setup.exe"','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else await pipeline(fs.createReadStream(installer),res);
  return;
 }
 if(await accounts.handle(req,res,u))return;
 const requireAccount=options.requireAccount||process.env.MUSIC_REQUIRE_ACCOUNT==='1';
 if(requireAccount&&u.pathname!=='/catalog/catalogue_artists'&&/^\/(catalog|media)\//.test(u.pathname)&&!accounts.session(req)&&!accounts.guest(req)){json(res,401,{error:'Войди в аккаунт или начни пробное прослушивание'});return;}
 if(u.pathname==='/lyrics'){json(res,200,await require('./lyrics.cjs').lyrics(u.searchParams));return;}
 if(u.pathname==='/artwork'){if(requireAccount&&!accounts.session(req)&&!accounts.guest(req)){res.writeHead(401).end();return;}const item=await require('./artwork.cjs').artwork(u.searchParams.get('url')||'');res.writeHead(200,{'Content-Type':item.type,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}).end(item.body);return;}
 if(u.pathname.startsWith('/catalog/')){
 const mode=u.pathname.slice(9);if(!['search','artists','catalogue_artists','resolve','resolve_hls','artist','related','import_playlist'].includes(mode)){res.writeHead(404).end();return;}
 if(mode==='catalogue_artists')accounts.allowArtistLookup(req);
 const client=accounts.session(req)?.id||clientAddress(req,trustProxy),value=(u.searchParams.get('value')||'').slice(0,500),offset=Math.max(0,Math.min(900,Number(u.searchParams.get('offset'))||0));
 if(requireAccount&&['resolve','resolve_hls'].includes(mode)&&!accounts.session(req)&&!accounts.guestTrack(req,value)){json(res,401,{error:'Пробные треки закончились. Создай аккаунт, чтобы продолжить и сохранить коллекцию.'});return;}
 const resolving=mode==='resolve'||mode==='resolve_hls';
 // Resolve ignores offset except as a worker cache key. Coalesce refreshes within five seconds.
 const cacheOffset=resolving&&u.searchParams.get('fresh')==='1'?1+Math.floor(Date.now()/5000)%899:offset;
 let result;
 try{result=await schedule(mode,value,cacheOffset,client);}
 catch(error){
  if(resolving&&/DRM protected|ограничен автором|нет открытого полного потока/i.test(error.message)){
   json(res,422,{code:'TRACK_UNAVAILABLE',error:'Эта версия недоступна на SoundCloud. Выбери другую запись.'});return;
  }
  throw error;
 }if(res.destroyed)return;const data=result&&!Array.isArray(result)&&typeof result==='object'?{...result}:result;if((mode==='resolve'||mode==='resolve_hls')&&data.hls)data.url=register(data.url);json(res,200,{data});return;}
 if(u.pathname.startsWith('/media/')){
 const item=media.get(u.pathname.slice(7));if(!item||Date.now()-item.time>7200000){res.writeHead(410).end();return;}
 const abort=new AbortController(),close=()=>{if(!res.writableFinished)abort.abort();};res.once('close',close);
 try{const r=await upstream(item.url,req.headers.range,abort.signal);if(!r.ok){res.writeHead(r.status).end();await r.body?.cancel();return;}const type=r.headers.get('content-type')||'';
 if(type.includes('mpegurl')||new URL(item.url).pathname.endsWith('.m3u8')){const text=await r.text(),rewritten=text.split('\n').map(line=>line.startsWith('#')?line.replace(/URI="([^"]+)"/g,(_,x)=>'URI="'+register(new URL(x,r.url||item.url).href)+'"'):line.trim()?register(new URL(line.trim(),r.url||item.url).href):line).join('\n');res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'private, max-age=60'}).end(rewritten);
 }else{res.statusCode=r.status;res.setHeader('Cache-Control','private, max-age=120');for(const h of ['content-type','content-length','content-range','accept-ranges'])if(r.headers.has(h))res.setHeader(h,r.headers.get(h));await pipeline(Readable.fromWeb(r.body),res);}
 }finally{res.off('close',close);}return;}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 let data,stat;try{stat=await fs.promises.stat(file);if(!stat.isFile())throw Error();data=await fs.promises.readFile(file);}catch{res.writeHead(404).end();return;}
 const etag='"'+crypto.createHash('sha256').update(data).digest('hex')+'"';res.setHeader('ETag',etag);res.setHeader('Last-Modified',stat.mtime.toUTCString());res.setHeader('Cache-Control','no-cache');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; connect-src 'self' https: blob:; media-src 'self' https: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');if(req.headers['if-none-match']===etag){res.writeHead(304).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.txt':'text/plain','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch(e){if(!res.headersSent)json(res,e.status||502,{error:e.message});else if(!res.destroyed)res.end();}});
 server.on('close',()=>accounts.close());server.on('error',reject);server.listen(port,options.host||'127.0.0.1',()=>resolve(server));
 });}
module.exports={serve};if(require.main===module)serve(8765).then(()=>console.log('Preview http://127.0.0.1:8765'));
