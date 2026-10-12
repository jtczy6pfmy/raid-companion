import unittest
from replay_profile import make_patch, validate_profile, patch_bytes, matches

class ProfileTests(unittest.TestCase):
    def profile(self):
        patch=make_patch([10,10,4,4],bytes(range(16)))
        return {'version':1,'client_size':[800,600],'executable_sha256':'a'*64,
                'states':{'Victory':{'patch':patch,'replay_patch':patch,'replay_point':[11,11]}}}
    def test_profile_pixels_round_trip(self):
        p=self.profile();validate_profile(p)
        self.assertEqual(patch_bytes(p['states']['Victory']['patch'],p['client_size']),bytes(range(16)))
    def test_replay_point_must_be_in_button(self):
        p=self.profile();p['states']['Victory']['replay_point']=[500,400]
        with self.assertRaises(ValueError):validate_profile(p)
    def test_patch_cannot_escape_client(self):
        p=self.profile();p['states']['Victory']['patch']['region']=[799,10,4,4]
        with self.assertRaises(ValueError):validate_profile(p)
    def test_wrong_pixel_length_rejects_profile(self):
        p=self.profile();p['states']['Victory']['patch']=make_patch([10,10,4,4],b'x'*100)
        with self.assertRaises(ValueError):validate_profile(p)
    def test_uniform_patch_is_rejected(self):
        p=self.profile();p['states']['Victory']['patch']=make_patch([10,10,4,4],bytes([100]*16))
        with self.assertRaises(ValueError):validate_profile(p)
    def test_matching_rejects_changed_and_empty_images(self):
        self.assertTrue(matches(b'abc',b'abc',0));self.assertFalse(matches(b'abc',b'xyz',4));self.assertFalse(matches(b'',b'',4))

if __name__=='__main__':unittest.main()
