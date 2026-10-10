"""Verify the preview cannot represent header access as working champion sync."""
import tkinter as tk
import unittest
from reader_app import ReaderWindow
from champion_memory import valid_hero_fields


class ReaderStatusTests(unittest.TestCase):
    def setUp(self):
        self.root = tk.Tk()
        self.root.withdraw()
        self.window = ReaderWindow(self.root)

    def tearDown(self):
        self.root.destroy()

    def test_header_access_does_not_claim_champion_sync(self):
        self.window.display({'status': 'memory_access_verified', 'champion_data_verified': False,
                             'process_id': 123, 'modules': [{'module': 'Raid.exe', 'header_read': True, 'valid_pe_signature': True}]})
        self.assertIn('not implemented', self.window.status.get())
        rows = [self.window.table.item(row)['values'] for row in self.window.table.get_children()]
        self.assertIn(['Champion / gear syncing', 'Not implemented'], rows)

    def test_access_denied_provides_retry_instruction(self):
        self.window.display({'status': 'unavailable', 'process_id': 123, 'windows_error': 5})
        self.assertIn('Run as administrator', self.window.status.get())
        self.assertNotIn('verified', self.window.status.get())

    def test_no_game_does_not_report_found(self):
        self.window.display({'status': 'unavailable', 'reason': 'RAID is not running'})
        self.assertEqual(self.window.status.get(), 'RAID is not running')
        first = self.window.table.get_children()[0]
        self.assertEqual(self.window.table.item(first)['values'], ['RAID process', 'Not found'])

    def test_memory_samples_remain_explicitly_unverified(self):
        self.window.display({'status': 'memory_samples_read', 'roster_verified': False,
                             'samples': [{'id': 10, 'type_id': 100, 'rank': 3, 'level': 30, 'name': 'Example'}]})
        self.assertIn('unverified', self.window.status.get())
        last = self.window.table.get_children()[-1]
        self.assertIn('Unverified roster membership', self.window.table.item(last)['values'][1])


class ChampionFieldTests(unittest.TestCase):
    def test_accepts_valid_copy_and_level_cap(self):
        self.assertTrue(valid_hero_fields(1, 100, 6, 60))
        self.assertTrue(valid_hero_fields(10, 200, 2, 1))

    def test_rejects_invalid_memory_interpretations(self):
        for values in [(0, 100, 6, 60), (1, 0, 6, 60), (1, 100, 7, 60), (1, 100, 2, 30), (1, 100, 6, 0), (100000000, 100, 6, 60)]:
            self.assertFalse(valid_hero_fields(*values))


if __name__ == '__main__':
    unittest.main()
