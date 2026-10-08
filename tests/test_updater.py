import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('update_bee', Path(__file__).resolve().parents[1] / 'scripts/update_bee.py')
bee = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bee)

SAMPLE = '<script type="application/json" id="archive-summary-data">' + json.dumps([
    {'date_iso': '2026-10-07', 'letters': 'A', 'all_letters': 'ABDFLOR'},
    {'date_iso': '2026-10-06', 'letters': 'C', 'all_letters': 'CDEHNOT'},
]) + '</script>'


class UpdaterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'data').mkdir()
        (self.root / 'data/pokemon.json').write_text(json.dumps({'pokemon': [
            {'id': 63, 'name': 'Abra'}, {'id': 151, 'name': 'Mew'}, {'id': 250, 'name': 'Ho-Oh'},
            {'id': 233, 'name': 'Porygon2'},
        ]}))

    def tearDown(self):
        self.temp.cleanup()

    def initialize(self):
        return bee.update(self.root, target='2026-10-07', archive_html=SAMPLE)

    def read(self, name):
        return json.loads((self.root / 'data' / name).read_text())

    def test_real_letter_metadata_schema_and_results(self):
        self.assertTrue(self.initialize())
        self.assertEqual(self.read('daily-bee.json')['center'], 'a')
        self.assertEqual(self.read('history.json')['stats']['counts'], {'yes': 1, 'almost': 1, 'no': 0})

    def test_idempotent_day_skips_network(self):
        self.initialize()
        with patch.object(bee, 'fetch_archive', side_effect=AssertionError('Unexpected source fetch')):
            self.assertFalse(bee.update(self.root, target='2026-10-07'))

    def test_stale_source_and_broken_markup_preserve_files(self):
        self.initialize()
        before = {p.name: p.read_bytes() for p in (self.root / 'data').glob('*.json')}
        for html in [SAMPLE, '<html>Page format changed</html>']:
            with self.assertRaises(ValueError):
                bee.update(self.root, target='2026-10-08', archive_html=html)
            self.assertEqual(before, {p.name: p.read_bytes() for p in (self.root / 'data').glob('*.json')})

    def test_partial_or_duplicate_manual_letters_do_not_write(self):
        self.initialize()
        for center, outer in [('a', ''), ('a', 'a b c d e f'), ('a', 'b b c d e f'), ('a', 'b c d e f 2')]:
            with self.assertRaises(ValueError):
                bee.update(self.root, target='2026-10-08', center=center, outer=outer)
        self.assertEqual(self.read('daily-bee.json')['date'], '2026-10-07')

    def test_manual_override_survives_automatic_refresh(self):
        self.initialize()
        bee.update(self.root, target='2026-10-07', center='b', outer='a d f l o r')
        bee.update(self.root, target='2026-10-07', force=True, archive_html=SAMPLE)
        self.assertEqual(self.read('daily-bee.json')['center'], 'b')
        self.assertEqual(self.read('daily-bee.json')['source'], 'manual')

    def test_historical_edit_does_not_roll_daily_back(self):
        self.initialize()
        bee.update(self.root, target='2026-10-05', center='v', outer='a i l o r t')
        self.assertEqual(self.read('daily-bee.json')['date'], '2026-10-07')
        self.assertEqual(len(self.read('history.json')['puzzles']), 3)

    def test_duplicate_dates_and_missing_center_are_rejected(self):
        rows = [{'date_iso': '2026-10-07', 'letters': 'A', 'all_letters': 'ABDFLOR'}] * 2
        for data in [rows, [{'date_iso': '2026-10-07', 'letters': 'Z', 'all_letters': 'ABDFLOR'}]]:
            with self.assertRaises(ValueError):
                bee.parse_archive('<script id="archive-summary-data">' + json.dumps(data) + '</script>')

    def test_pangram_metadata_is_seven_distinct_letters(self):
        row = [{'date_iso': '2024-11-30', 'letters': 'C', 'all_letters': 'CLAIMANT'}]
        puzzle = bee.parse_archive('<script id="archive-summary-data">' + json.dumps(row) + '</script>')[0]
        self.assertEqual(set([puzzle['center'], *puzzle['outer']]), set('claimnt'))

    def test_minimum_and_digit_rules(self):
        self.assertEqual(bee.normalize_name('Flabébé'), 'flabebe')
        self.assertEqual(bee.normalize_name('Nidoran♀'), 'nidoran')
        stats = bee.calculate_stats([{'date': '2026-10-07', 'center': 'm', 'outer': list('ewabcx')}],
                                    [{'id': 1, 'name': 'Mew'}])
        self.assertEqual(stats['counts']['no'], 1)


if __name__ == '__main__':
    unittest.main()
