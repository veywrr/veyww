import unittest,json
from pathlib import Path
from unittest.mock import patch
from playlist_import import identify,spotify_document,yandex_document,read_public,vk_document,import_playlist
from urllib.error import HTTPError

class PlaylistImportTest(unittest.TestCase):
 def test_only_expected_https_playlist_addresses(self):
  for url in ['http://open.spotify.com/playlist/'+'a'*22,'https://open.spotify.com.evil.test/playlist/'+'a'*22,'https://user@music.yandex.ru/users/a/playlists/1','https://127.0.0.1/','https://music.yandex.ru:444/playlists/'+'a'*36]:
   with self.subTest(url=url),self.assertRaises(ValueError):identify(url)
  self.assertEqual(identify('https://music.yandex.ru/playlists/lk.12345678-1234-4123-a123-123456789abc')[1][0],'uuid')
 def test_spotify_metadata_never_imports_preview_audio(self):
  entity={'type':'playlist','name':'Demo','trackList':[{'uri':'spotify:track:0123456789012345678901','title':'Demo','subtitle':'Odiseo','duration':90000}]}
  text='<script id="__NEXT_DATA__">'+json.dumps({'props':{'pageProps':{'state':{'data':{'entity':entity}}}}})+'</script>'
  p=spotify_document(text,'https://open.spotify.com/playlist/0123456789012345678901')
  self.assertEqual(len(p['tracks']),1);self.assertEqual(p['tracks'][0]['artist'],'Odiseo')
  self.assertFalse(p['complete']);self.assertIsNone(p['total']);self.assertTrue(all(not t['url'] for t in p['tracks']))
 def test_yandex_partial_tracks_cannot_be_reported_as_complete(self):
  data={'result':{'title':'Test','trackCount':2,'tracks':[{'track':{'id':1,'title':'Песня','artists':[{'name':'Артист'}]}},{'id':2}]}}
  p=yandex_document(data,'https://music.yandex.ru/users/a/playlists/1')
  self.assertFalse(p['complete']);self.assertEqual(p['total'],2);self.assertEqual(len(p['tracks']),1)
 def test_region_refusal_is_actionable(self):
  with patch('playlist_import.build_opener') as mock:
   mock.return_value.open.side_effect=HTTPError('https://example.test',451,'unavailable',{},None)
   with self.assertRaisesRegex(ValueError,'451'):read_public('https://api.music.yandex.net/playlist/test')
 def test_vk_link_formats_and_metadata_without_audio_credentials(self):
  key='12345678_123_0123456789abcdef01'
  for url in ['https://vk.ru/music/playlist/'+key,'https://vk.com/audio?z=audio_playlist'+key,'https://music.vk.com/playlist/'+key]:
   self.assertEqual(identify(url)[1],key)
  row=[123,12345678,'https://private-audio.example/secret','Song &amp; Title','Artist',180]
  from html import escape
  result=vk_document('<meta property="og:title" content="My playlist"><div data-audio="'+escape(json.dumps(row),quote=True)+'"></div>','https://vk.ru/music/playlist/'+key)
  self.assertEqual(result['tracks'][0]['title'],'Song & Title');self.assertFalse(result['tracks'][0]['url']);self.assertFalse(result['complete'])
  self.assertNotIn('secret',json.dumps(result))
 def test_vk_private_page_is_an_error_and_never_an_empty_success(self):
  with self.assertRaisesRegex(ValueError,'VK'):vk_document('<html>Войдите</html>','https://vk.ru/music/playlist/1_2')
 def test_vk_structured_playlist_retains_versions_and_full_count(self):
  data={'@type':'MusicPlaylist','name':'VK mix','numTracks':1,'track':[{'@type':'MusicRecording','name':'Song (remix)','byArtist':{'name':'Artist'},'duration':'PT3M20S'}]}
  result=vk_document('<script type="application/ld+json">'+json.dumps(data)+'</script>','https://vk.ru/music/playlist/1_2')
  self.assertTrue(result['complete']);self.assertEqual(result['tracks'][0]['duration'],200)
 def test_yandex_stub_metadata_is_hydrated_without_changing_order(self):
  playlist={'result':{'title':'Mine','trackCount':2,'tracks':[{'id':'2','albumId':'3'},{'track':{'id':'1','title':'One','artists':[{'name':'A'}]}}]}}
  with patch('playlist_import.read_public',side_effect=[json.dumps(playlist),json.dumps({'result':[{'id':'2','title':'Two','artists':[{'name':'B'}]}]})]) as request:
   result=import_playlist('https://music.yandex.ru/users/test/playlists/1')
   self.assertEqual([t['title'] for t in result['tracks']],['Two','One']);self.assertTrue(result['complete']);self.assertEqual(request.call_count,2)

if __name__=='__main__':unittest.main()
