"""Read public playlist metadata only. No login, playback URLs or borrowed tokens."""
import json,re,ssl,html
from html.parser import HTMLParser
from urllib.parse import urlparse,quote,parse_qs,urlencode,urljoin
from urllib.request import Request,urlopen,HTTPRedirectHandler,HTTPSHandler,build_opener
from urllib.error import HTTPError
import certifi

class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def read_public(url,data=None,redirects=0):
 opener=build_opener(NoRedirect(),HTTPSHandler(context=ssl.create_default_context(cafile=certifi.where())))
 try:
  with opener.open(Request(url,data=data,headers={'User-Agent':'Mozilla/5.0 (compatible; veyww/0.11)','Accept':'application/json,text/html'}),timeout=12) as r:
   raw=r.read(8_000_001)
   if len(raw)>8_000_000:raise ValueError('Плейлист слишком большой. Используй файл CSV.')
   return raw.decode(r.headers.get_content_charset() or 'utf-8',errors='replace')
 except HTTPError as e:
  if e.code in (301,302,303,307,308):
   target=urljoin(url,e.headers.get('Location',''))
   if redirects<2:
    try:
     before=identify(url);after=identify(target)
     if before[:2]==after[:2]:return read_public(target,data if e.code in (307,308) else None,redirects+1)
    except ValueError:pass
   raise ValueError('Сервис перенаправляет на вход или не отдаёт публичный список. Для VK попробуй экспорт CSV или вставь названия треков. Пароль сервиса не нужен.') from None
  if e.code==451:raise ValueError('Сервис недоступен в этом регионе (HTTP 451). Перенеси список через файл или текст.') from None
  if e.code in (401,403,404):raise ValueError('Плейлист закрыт, не найден или сервис требует входа. Используй экспорт в файл.') from None
  raise ValueError('Сервис не отдал плейлист (HTTP '+str(e.code)+'). Используй файл или попробуй позже.') from None

def identify(value):
 p=urlparse(str(value).strip())
 if p.scheme!='https' or p.port not in (None,443) or p.username or p.password:raise ValueError('Вставь HTTPS-ссылку на плейлист Яндекса, VK Музыки или Spotify.')
 if p.hostname in ('vk.ru','vk.com','m.vk.ru','m.vk.com','music.vk.com','music.vk.ru'):
  candidate=p.path
  if p.path in ('/audio','/music'):
   candidate='/'+parse_qs(p.query).get('z',[''])[0]
  m=re.fullmatch(r'/(?:music/playlist/|playlist/|audio_playlist)(-?\d{1,20})_(\d{1,20})(?:_([a-zA-Z0-9]{1,100}))?/?',candidate)
  if m:
   key=m[1]+'_'+m[2]+('_'+m[3] if m[3] else '')
   host='vk.ru' if p.hostname.endswith('vk.ru') else 'vk.com'
   return 'VK Музыка',key,'https://'+host+'/music/playlist/'+key
 if p.hostname=='open.spotify.com':
  m=re.fullmatch(r'/(?:intl-[a-z]{2}/)?(?:embed/)?playlist/([A-Za-z0-9]{22})/?',p.path)
  if m:return 'Spotify',m[1],'https://open.spotify.com/playlist/'+m[1]
 if p.hostname in ('music.yandex.ru','music.yandex.com','music.yandex.kz','music.yandex.by'):
  m=re.fullmatch(r'/playlists/((?:lk\.)?[a-fA-F0-9-]{36})/?',p.path)
  if m:return 'Яндекс Музыка',('uuid',m[1]),'https://'+p.hostname+'/playlists/'+m[1]
  m=re.fullmatch(r'/users/([\w.@-]{1,100})/playlists/(\d{1,12})/?',p.path)
  if m:return 'Яндекс Музыка',('owner',m[1],m[2]),'https://'+p.hostname+p.path.rstrip('/')
 raise ValueError('Поддерживаются ссылки на плейлисты Яндекс Музыки, VK Музыки и Spotify. Можно также загрузить CSV, M3U, JSON или список треков.')

def spotify_document(text,page):
 m=re.search(r'<script\b(?=[^>]*\bid=["\']__NEXT_DATA__["\'])[^>]*>(.*?)</script>',text,re.S)
 if not m:raise ValueError('Spotify не отдал публичный список. Используй экспорт CSV.')
 try:entity=json.loads(m[1])['props']['pageProps']['state']['data']['entity']
 except (ValueError,KeyError,TypeError):raise ValueError('Формат Spotify изменился. Используй экспорт CSV.') from None
 if entity.get('type')!='playlist':raise ValueError('Это не плейлист Spotify.')
 tracks=[]
 for i,t in enumerate(entity.get('trackList') or []):
  if not t.get('title') or t.get('entityType')!='track':continue
  remote=str(t.get('uri','')).split(':')[-1]
  tracks.append({'id':'import:spotify:'+str(i)+':'+remote,'title':t['title'],'artist':t.get('subtitle',''),'duration':(t.get('duration') or 0)/1000,'source':'Spotify','originUrl':'https://open.spotify.com/track/'+remote,'url':'','page':''})
 if not tracks:raise ValueError('В публичном списке Spotify нет доступных названий. Используй CSV.')
 # Embeds do not expose a reliable full count. Never label this as a complete transfer.
 return {'name':entity.get('name') or entity.get('title') or 'Spotify','tracks':tracks,'total':None,'complete':False,'source':'Spotify','originUrl':page,'warning':'Получено '+str(len(tracks))+' названий из публичной страницы Spotify. Список может быть неполным; полный перенос — через CSV. Это названия, а не аудиозаписи.'}

def yandex_document(data,page):
 p=data.get('result')
 if not isinstance(p,dict) or data.get('error'):raise ValueError('Яндекс не отдал открытый плейлист. Используй файл или список треков.')
 tracks=[]
 for i,entry in enumerate(p.get('tracks') or []):
  t=entry.get('track') or entry
  if not t.get('title'):continue
  title=t['title']+(' ('+t['version']+')' if t.get('version') else '')
  remote=str(t.get('id',''))
  tracks.append({'id':'import:yandex:'+str(i)+':'+remote,'title':title,'artist':', '.join(a.get('name','') for a in t.get('artists',[])),'duration':(t.get('durationMs') or 0)/1000,'source':'Яндекс Музыка','originUrl':'https://music.yandex.ru/track/'+remote,'url':'','page':''})
 if not tracks:raise ValueError('Яндекс не отдал названия треков. Плейлист может требовать входа. Используй экспорт в файл.')
 total=p.get('trackCount');complete=isinstance(total,int) and len(tracks)==total
 return {'name':p.get('title') or 'Яндекс Музыка','tracks':tracks,'total':total,'complete':complete,'source':'Яндекс Музыка','originUrl':page,'warning':('Перенос названий. Аудио будет искаться в подключённом каталоге.' if complete else 'Получен неполный список: '+str(len(tracks))+' из '+str(total or '?')+'. Для полного переноса используй файл.')}

def import_playlist(value,offset=0):
 source,key,page=identify(value)
 if source=='Spotify':return spotify_document(read_public('https://open.spotify.com/embed/playlist/'+key),page)
 if source=='VK Музыка':return vk_document(read_public(page),page)
 # Fixed hosts and validated path components; never fetch an arbitrary supplied URL.
 endpoint=('playlist/'+quote(key[1],safe='') if key[0]=='uuid' else 'users/'+quote(key[1],safe='')+'/playlists/'+key[2])
 try:
  data=json.loads(read_public('https://api.music.yandex.net/'+endpoint+'?rich-tracks=true'))
  playlist=data.get('result') or {}
  entries=playlist.get('tracks') or []
  missing=[str(e.get('id'))+(':'+str(e['albumId']) if e.get('albumId') else '') for e in entries if not (e.get('track') or e).get('title') and e.get('id')]
  hydrated={};failed=False
  for at in range(0,len(missing),100):
   try:
    response=json.loads(read_public('https://api.music.yandex.net/tracks',urlencode({'track-ids':','.join(missing[at:at+100])}).encode()))
    for track in response.get('result') or []:
     if isinstance(track,dict) and track.get('title'):hydrated[str(track.get('id'))]=track
   except (ValueError,OSError):failed=True;break
  for e in entries:
   if not (e.get('track') or e).get('title') and str(e.get('id')) in hydrated:e['track']=hydrated[str(e['id'])]
  result=yandex_document(data,page)
  if failed:result['warning']+=' Часть названий не загрузилась из-за ошибки сервиса. Повтори загрузку списка; это не означает, что треки отсутствуют.'
  return result
 except json.JSONDecodeError:raise ValueError('Яндекс вернул страницу вместо списка треков. Используй файл или текст.') from None

class VKPublicPage(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.rows=[];self.documents=[];self.name='VK Музыка';self.script=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta' and a.get('property')=='og:title':self.name=a.get('content') or self.name
  if a.get('data-audio'):
   try:self.rows.append(json.loads(a['data-audio']))
   except (ValueError,TypeError):pass
  if tag=='script' and (a.get('type') in ('application/json','application/ld+json') or a.get('id') in ('__NEXT_DATA__','__INITIAL_STATE__')):self.script=''
 def handle_data(self,data):
  if self.script is not None:self.script+=data
 def handle_endtag(self,tag):
  if tag=='script' and self.script is not None:
   try:self.documents.append(json.loads(self.script))
   except (ValueError,TypeError):pass
   self.script=None

def vk_document(text,page):
 """Only metadata exposed in the public page; never extract VK playback credentials."""
 parser=VKPublicPage();parser.feed(text)
 tracks=[];seen=set();total=None
 def add(t):
  if isinstance(t,list) and len(t)>=6:
   t={'id':str(t[1])+'_'+str(t[0]),'title':t[3],'artist':t[4],'duration':t[5]}
  if not isinstance(t,dict):return
  if 'item' in t and isinstance(t['item'],dict):t=t['item']
  title=t.get('title') or t.get('name');artist=t.get('artist') or t.get('performer') or t.get('byArtist') or ''
  if isinstance(artist,list):artist=', '.join(a.get('name','') if isinstance(a,dict) else str(a) for a in artist)
  if isinstance(artist,dict):artist=artist.get('name','')
  if not title or not artist:return
  title=html.unescape(str(title));artist=html.unescape(str(artist));key=(str(t.get('id','')),title,artist)
  if key in seen:return
  seen.add(key);duration=t.get('duration') or 0
  if isinstance(duration,str):
   m=re.fullmatch(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?',duration)
   duration=sum(float(v or 0)*factor for v,factor in zip(m.groups(),(3600,60,1))) if m else 0
  tracks.append({'id':'import:vk:'+str(len(tracks))+':'+str(t.get('id','')),'title':title,'artist':artist,'duration':duration,'source':'VK Музыка','originUrl':page,'url':'','page':''})
 def scan(node,depth=0):
  nonlocal total
  if depth>15:return
  if isinstance(node,list):
   for item in node:scan(item,depth+1)
  elif isinstance(node,dict):
   kind=node.get('@type');is_playlist=kind in ('MusicPlaylist','ItemList') or ('list' in node and ('owner_id' in node or 'playlist_id' in node))
   if is_playlist:
    for key in ('numTracks','numberOfItems','total_count','total'):
     if isinstance(node.get(key),int):total=max(total or 0,node[key])
    parser.name=node.get('name') or node.get('title') or parser.name
    for item in node.get('track') or node.get('itemListElement') or node.get('list') or []:add(item)
   else:
    for child in node.values():
     if isinstance(child,(dict,list)):scan(child,depth+1)
 for row in parser.rows:add(row)
 for document in parser.documents:scan(document)
 if not tracks:raise ValueError('VK не отдал открытый список треков. Проверь доступ по ссылке без входа; если VK требует авторизацию, используй CSV или список названий. Пароль VK не нужен.')
 complete=total is not None and total==len(tracks)
 return {'name':parser.name,'tracks':tracks,'total':total,'complete':complete,'source':'VK Музыка','originUrl':page,'warning':('Получен открытый список VK. Аудио подберём в подключённом каталоге.' if complete else 'Получено '+str(len(tracks))+' названий из публичной страницы VK. Полнота не подтверждена; для полного списка можно использовать CSV.')}
