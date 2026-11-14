"""Public SoundCloud metadata and unprotected streams; cached, with no account access."""
import json,sys,time,threading,concurrent.futures,re
from urllib.parse import urlparse
from playlist_import import import_playlist
from artist_catalog import catalogue_artists
from yt_dlp import YoutubeDL
from yt_dlp.extractor.soundcloud import SoundcloudUserIE,SoundcloudRelatedIE,SoundcloudIE as OriginalSoundcloudIE,SoundcloudSearchIE as OriginalSoundcloudSearchIE

from yt_dlp.utils import ExtractorError

def widget_client_ids(script):
 """Read public application identifiers from the official widget configuration."""
 for config in re.findall(r'client_id\s*:[^,;]{0,200}',script):
  for value in re.findall(r'["\x27]([A-Za-z0-9]{32})["\x27]',config):
   yield value

class WidgetClientFallback:
 def _update_client_id(self):
  try:
   return super()._update_client_id()
  except ExtractorError as original:
   # Some networks cannot reach the main page while the public widget/API work.
   # This does not provide account credentials or unlock restricted tracks.
   page=self._download_webpage('https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fmadk1d',None,'Downloading public widget',fatal=False)
   if page:
    for asset in reversed(re.findall(r'<script[^>]+src="([^"]+)"',page)):
     if not asset.startswith('https://widget.sndcdn.com/'):continue
     script=self._download_webpage(asset,None,'Downloading widget asset',fatal=False)
     if not script:continue
     client_id=next(widget_client_ids(script),None)
     if client_id:
      self._CLIENT_ID=client_id
      self._store_client_id(client_id)
      return
   raise original

class FastArtwork:
 def _extract_info_dict(self,info,*args,**kwargs):
  # Flat searches must skip known previews/blocked items without failing the entire page.
  # Direct playback still uses the original extractor's access checks.
  if kwargs.get('extract_flat') and (info.get('policy') in ('BLOCK','SNIP') or info.get('access') in ('preview','blocked') or info.get('streamable') is False):
   return {'id':str(info.get('id','')),'title':info.get('title',''),'webpage_url':info.get('permalink_url',''),'veyww_unplayable':True}
  return super()._extract_info_dict(info,*args,**kwargs)
 def _extract_thumbnails(self,info):
  url=info.get('artwork_url') or (info.get('user') or {}).get('avatar_url')
  if not url:return []
  url=re.sub(r'-(?:large|original|t\d+x\d+)\.(?:jpg|png)(?:\?.*)?$','-t500x500.jpg',url)
  return [{'url':url,'width':500,'height':500}]
class SoundcloudIE(WidgetClientFallback,FastArtwork,OriginalSoundcloudIE):pass
class SoundcloudSearchIE(WidgetClientFallback,FastArtwork,OriginalSoundcloudSearchIE):pass

class RichEntries(FastArtwork):
 def _entries(self,url,playlist_id):
  query={'limit':100,'linked_partitioning':'1','offset':0}
  while url:
   response=self._call_api(url,playlist_id,query=query,headers=self._HEADERS)
   for entry in response.get('collection') or []:
    track=entry.get('track') or entry
    if track.get('permalink_url'):
     yield self.url_result(track['permalink_url'],SoundcloudIE.ie_key(),**self._extract_info_dict(track,extract_flat=True))
   url=response.get('next_href');query={}
class RichSoundcloudUserIE(WidgetClientFallback,RichEntries,SoundcloudUserIE):pass
class RichSoundcloudRelatedIE(WidgetClientFallback,RichEntries,SoundcloudRelatedIE):pass

class Quiet:
 def debug(self,*args):pass
 def warning(self,*args):pass
 def error(self,*args):pass

_lock=threading.RLock();_cache={};_running={};_local=threading.local();_extractor_cache={}
class MemoryCache:
 def load(self,section,key,default=None,**kwargs):
  with _lock:return _extractor_cache.get((section,key),default)
 def store(self,section,key,data,**kwargs):
  with _lock:_extractor_cache[(section,key)]=data

def client(flat=False,offset=0,limit=30):
 if not hasattr(_local,'ydl'):
  _local.ydl=YoutubeDL({'quiet':True,'logger':Quiet(),'skip_download':True,'cachedir':False,'socket_timeout':12,'retries':0,'extractor_retries':0,'ignoreerrors':False},auto_init=False)
  _local.ydl.cache=MemoryCache()
  _local.ydl.add_info_extractor(SoundcloudIE(_local.ydl))
  _local.ydl.add_info_extractor(SoundcloudSearchIE(_local.ydl))
  _local.ydl.add_info_extractor(RichSoundcloudUserIE(_local.ydl))
  _local.ydl.add_info_extractor(RichSoundcloudRelatedIE(_local.ydl))
 y=_local.ydl;y.params.update({'extract_flat':flat,'noplaylist':not flat,'playliststart':offset+1,'playlistend':offset+limit})
 return y

def valid_page(page,profile=False):
 p=urlparse(str(page));parts=p.path.strip('/').split('/')
 if p.scheme!='https' or p.hostname not in ('soundcloud.com','www.soundcloud.com') or p.port not in (None,443) or p.username or len(parts)!=(1 if profile else 2):raise ValueError('Нужна открытая ссылка SoundCloud')
 return 'https://soundcloud.com/'+p.path.strip('/')

def normalize(t):
 if t.get('veyww_unplayable') or t.get('is_drm') or t.get('availability') in ('premium_only','subscriber_only','needs_auth','private'):return None
 credits=t.get('artists') or []
 if isinstance(credits,str):credits=[credits]
 credit=', '.join(a for a in credits if isinstance(a,str)) or t.get('artist') or ''
 uploader=t.get('uploader') or 'SoundCloud'
 url=t.get('webpage_url') or t.get('url','')
 if urlparse(url).hostname not in ('soundcloud.com','www.soundcloud.com'):return None
 profile=t.get('uploader_url') or ''
 if urlparse(profile).hostname not in ('soundcloud.com','www.soundcloud.com'):profile='https://soundcloud.com/'+urlparse(url).path.strip('/').split('/')[0]
 return {'id':'soundcloud:'+str(t['id']),'remoteId':str(t['id']),'page':url,'artistPage':profile,'title':t.get('title') or 'Трек','artist':credit or uploader,'catalogArtist':bool(credit and credit.casefold()!=uploader.casefold()),'duration':t.get('duration') or 0,'plays':max(0,t.get('view_count') or 0),'likesCount':max(0,t.get('like_count') or 0),'genre':t.get('genre') or (t.get('genres') or [''])[0], 'art':t.get('thumbnail') or (t.get('thumbnails') or [{}])[-1].get('url',''),'source':'SoundCloud','url':''}

def collection(url,offset=0):
 y=client(True,offset);kind='RichSoundcloudUser' if url.endswith('/tracks') else 'RichSoundcloudRelated' if url.endswith('/recommended') else None
 r=y.extract_info(url,download=False,ie_key=kind)
 tracks=[n for t in r.get('entries',[]) if t and (n:=normalize(t))]
 return r,tracks

def search(query,offset=0):
 query=str(query).strip()[:200]
 if not query:return []
 return collection('scsearch'+str(offset+30)+':'+query,offset)[1]

def artists(query,offset=0):
 query=str(query).strip()[:200]
 if not query:return []
 ie=client(True).get_info_extractor('SoundcloudSearch');ie.initialize()
 response=ie._call_api('https://api-v2.soundcloud.com/search/users',query,query={'q':query,'limit':30,'offset':offset,'linked_partitioning':1},headers=ie._HEADERS)
 result=[]
 for user in response.get('collection') or []:
  try:page=valid_page(user.get('permalink_url'),True)
  except (ValueError,TypeError):continue
  result.append({'id':'soundcloud-user:'+str(user.get('id','')),'name':str(user.get('username') or user.get('full_name') or page.rsplit('/',1)[-1]),'page':page,'art':user.get('avatar_url') or '', 'followers':max(0,user.get('followers_count') or 0),'verified':bool((user.get('badges') or {}).get('verified'))})
 return result

def artist(page,offset=0):
 page=valid_page(page,True);r,tracks=collection(page+'/tracks',offset)
 return {'page':page,'name':r.get('uploader') or r.get('title','').removesuffix(' (Tracks)') or (tracks[0]['artist'] if tracks else urlparse(page).path[1:]),'tracks':tracks}

def related(page,offset=0):return collection(valid_page(page)+'/recommended',offset)[1]

def resolve(page,hls_only=False):
 page=valid_page(page);info=client(False).extract_info(page,download=False)
 if info.get('is_drm') or info.get('availability') in ('premium_only','subscriber_only','needs_auth','private'):raise ValueError('Трек ограничен автором или подпиской')
 formats=[f for f in info.get('formats',[]) if not f.get('has_drm') and f.get('url') and 'preview' not in f.get('format_id','').lower() and f.get('protocol') in ('m3u8_native','m3u8','https','http')]
 if hls_only:formats=[f for f in formats if 'm3u8' in f.get('protocol','')]
 if not formats:raise ValueError('Нет открытого полного потока')
 f=max(formats,key=lambda f:f.get('abr') or 0)
 return {'url':f['url'],'hls':'m3u8' in f.get('protocol',''),'duration':info.get('duration'),'track':normalize(info)}

def execute(mode,value,offset=0):
 if mode not in ('search','artists','catalogue_artists','resolve','artist','related','import_playlist','resolve_hls'):raise ValueError('Неизвестный запрос')
 offset=max(0,min(900,int(offset)));key=(mode,str(value),offset);ttl=240 if mode in ('resolve','resolve_hls') else 600
 with _lock:
  hit=_cache.get(key)
  if hit and time.monotonic()-hit[0]<ttl:return hit[1]
  waiting=_running.get(key)
  if not waiting:_running[key]=threading.Event()
 if waiting:
  if not waiting.wait(45):raise TimeoutError('Источник не ответил')
  with _lock:
   hit=_cache.get(key)
   if hit:return hit[1]
  raise ValueError('Источник временно недоступен')
 try:
  result=resolve(value,hls_only=mode=='resolve_hls') if mode in ('resolve','resolve_hls') else globals()[mode](value,offset)
  with _lock:
   _cache[key]=(time.monotonic(),result)
   if len(_cache)>250:
    for k in list(_cache)[:50]:_cache.pop(k,None)
  return result
 finally:
  with _lock:_running.pop(key).set()

def call(mode,value,offset=0):
 try:return json.dumps({'data':execute(mode,value,offset)},ensure_ascii=False)
 except Exception as e:return json.dumps({'error':str(e).replace('ERROR: ','')[:700]},ensure_ascii=False)

def worker():
 output_lock=threading.Lock()
 def task(request):
  result=json.loads(call(request.get('mode'),request.get('value',''),request.get('offset',0)));result['id']=request.get('id')
  with output_lock:print(json.dumps(result,ensure_ascii=False),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for line in sys.stdin:
   try:pool.submit(task,json.loads(line))
   except (ValueError,TypeError):pass

if __name__=='__main__':
 if hasattr(sys.stdin,'reconfigure'):sys.stdin.reconfigure(encoding='utf-8')
 if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf-8')
 if len(sys.argv)>1 and sys.argv[1]=='--worker':worker()
 else:print(call(sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 0))
