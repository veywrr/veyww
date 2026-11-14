import unittest
from unittest.mock import patch
from artist_catalog import catalogue_artists

class ArtistCatalogueTest(unittest.TestCase):
 def test_uses_artist_names_not_uploaders_and_merges_spacing(self):
  def read(url):
   return {'results':[{'artistName':'FORTUNA 812'},{'artistName':'Unrelated'}]} if 'itunes' in url else {'data':[{'name':'fortuna812'}]}
  with patch('artist_catalog.read',side_effect=read):
   self.assertEqual(catalogue_artists('fortuna812'),[{'name':'FORTUNA 812'}])
 def test_one_failed_source_does_not_discard_other_catalogue(self):
  def read(url):
   if 'itunes' in url:raise TimeoutError()
   return {'data':[{'name':'madk1d'}]}
  with patch('artist_catalog.read',side_effect=read):self.assertEqual(catalogue_artists('madk1d'),[{'name':'madk1d'}])
 def test_empty_and_pagination_do_not_hit_remote_services(self):
  with patch('artist_catalog.read') as read:
   self.assertEqual(catalogue_artists('x'),[]);self.assertEqual(catalogue_artists('FACE',30),[]);read.assert_not_called()

if __name__=='__main__':unittest.main()
