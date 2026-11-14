import unittest
import catalog

class MetadataTest(unittest.TestCase):
 def test_credits_are_separate_from_upload_account(self):
  track=catalog.normalize({'id':'1','title':'Song','webpage_url':'https://soundcloud.com/label/song','uploader':'Label uploads','artists':['Real Artist']})
  self.assertEqual(track['artist'],'Real Artist');self.assertTrue(track['catalogArtist'])
 def test_legacy_uploads_remain_usable_without_false_official_claim(self):
  track=catalog.normalize({'id':'2','title':'Song','webpage_url':'https://soundcloud.com/artist/song','uploader':'Artist'})
  self.assertEqual(track['artist'],'Artist');self.assertFalse(track['catalogArtist'])
 def test_known_previews_and_blocks_do_not_break_flat_search(self):
  extractor=object.__new__(catalog.FastArtwork)
  for policy in ['BLOCK','SNIP']:
   info=extractor._extract_info_dict({'id':1,'policy':policy,'permalink_url':'https://soundcloud.com/a/song'},extract_flat=True)
   self.assertIsNone(catalog.normalize(info))

if __name__=='__main__':unittest.main()
