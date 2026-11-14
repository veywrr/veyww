import unittest
from unittest.mock import patch
import catalog

class FakeIE:
 _HEADERS={}
 def initialize(self):pass
 def _call_api(self,url,query_id,query,headers):
  self.query=query
  return {'collection':[{'id':12,'username':'CULT MEMBER','permalink_url':'https://soundcloud.com/cultmembr','followers_count':100,'badges':{'verified':True}}, {'id':13,'username':'Wrong host','permalink_url':'https://example.com/artist'}, {'id':14,'username':'Wrong type','permalink_url':'https://soundcloud.com/a/track'}]}
 def get_info_extractor(self,name):return self

class ArtistTests(unittest.TestCase):
 def test_public_profiles_keep_real_identity_and_reject_non_profiles(self):
  fake=FakeIE()
  with patch.object(catalog,'client',return_value=fake):result=catalog.artists('cult member',30)
  self.assertEqual(len(result),1);self.assertEqual(result[0]['page'],'https://soundcloud.com/cultmembr');self.assertTrue(result[0]['verified']);self.assertEqual(fake.query['offset'],30)
 def test_blank_search_does_not_connect(self):
  with patch.object(catalog,'client') as client:self.assertEqual(catalog.artists(' '),[]);client.assert_not_called()

if __name__=='__main__':unittest.main()
