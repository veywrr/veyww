import unittest
from catalog import widget_client_ids,WidgetClientFallback
from yt_dlp.utils import ExtractorError

PUBLIC='a'*32
class Base:
 def _update_client_id(self):
  if self.main_ok:return 'main'
  raise self.original

class Dummy(WidgetClientFallback,Base):
 def __init__(self,pages,main_ok=False):
  self.pages=pages;self.main_ok=main_ok;self.original=ExtractorError('main unavailable');self.saved=None;self.requested=[]
 def _download_webpage(self,url,*args,**kwargs):
  self.requested.append(url)
  return self.pages.get(url)
 def _store_client_id(self,value):self.saved=value

WIDGET='https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fmadk1d'
ASSET='https://widget.sndcdn.com/widget-test.js'

class WidgetTests(unittest.TestCase):
 def test_reads_direct_and_conditional_public_ids(self):
  self.assertEqual(list(widget_client_ids('client_id:"'+PUBLIC+'"')),[PUBLIC])
  self.assertEqual(list(widget_client_ids('client_id:flag?"'+PUBLIC+'":"'+('b'*32)+'"')),[PUBLIC,'b'*32])
 def test_rejects_wrong_length_and_unrelated_properties(self):
  self.assertEqual(list(widget_client_ids('client_id:"short",token:"'+PUBLIC+'"')),[])
 def test_normal_bootstrap_keeps_existing_behavior(self):
  ie=Dummy({},True);self.assertEqual(ie._update_client_id(),'main');self.assertEqual(ie.requested,[])
 def test_widget_fallback_uses_official_assets_and_caches_id(self):
  evil='https://example.com/widget.js'
  ie=Dummy({WIDGET:'<script src="'+ASSET+'"></script><script src="'+evil+'"></script>',ASSET:'client_id:x?"'+PUBLIC+'":"'+('b'*32)+'"'})
  ie._update_client_id();self.assertEqual(ie.saved,PUBLIC);self.assertNotIn(evil,ie.requested)
 def test_missing_widget_preserves_original_failure(self):
  ie=Dummy({})
  with self.assertRaises(ExtractorError) as caught:ie._update_client_id()
  self.assertIs(caught.exception,ie.original)

if __name__=='__main__':unittest.main()
