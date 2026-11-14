"""Artist names from release catalogues, separate from audio/upload accounts."""
import concurrent.futures,json,re,unicodedata
from urllib.parse import urlencode
from urllib.request import Request,urlopen

def key(value):
 return re.sub(r'[^\w]+','',unicodedata.normalize('NFKC',str(value)).casefold())

def read(url):
 with urlopen(Request(url,headers={'User-Agent':'veyww/0.18 artist search'}),timeout=6) as response:
  return json.loads(response.read(1024*1024))

def catalogue_artists(query,offset=0):
 query=str(query).strip()[:100]
 if len(query)<2 or offset:return []
 def apple():
  data=read('https://itunes.apple.com/search?'+urlencode({'term':query,'entity':'musicArtist','limit':12}))
  return [{'name':x['artistName']} for x in data.get('results',[]) if x.get('artistName')]
 def deezer():
  data=read('https://api.deezer.com/search/artist?'+urlencode({'q':query,'limit':12}))
  return [{'name':x['name']} for x in data.get('data',[]) if x.get('name')]
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(fn) for fn in (apple,deezer)]
  for future in futures:
   try:results.extend(future.result())
   except Exception:pass
 # No SoundCloud page: a distributor artist is not a verified upload account.
 unique={}
 for artist in results:
  identity=key(artist['name'])
  if key(query) in identity:unique.setdefault(identity,artist)
 return sorted(unique.values(),key=lambda a:(key(a['name'])!=key(query),len(a['name'])))[:20]
