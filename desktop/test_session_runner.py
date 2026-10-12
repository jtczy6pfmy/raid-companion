import unittest
from session_runner import RunPlan, run_session


class Adapter:
    def __init__(self, screens, ready=True):
        self.screens = iter(screens)
        self.screen = 'Unknown'
        self.available = ready
        self.clicks = []
    def ready(self): return self.available
    def stop_requested(self): return False
    def observe(self):
        self.screen = next(self.screens, self.screen)
        return self.screen
    def replay(self, result):
        self.clicks.append(result)
        return True


class SessionTests(unittest.TestCase):
    def execute(self, adapter, runs=2, live=True):
        ticks = [0.0]
        def sleep(seconds): ticks[0] += seconds
        return run_session(RunPlan(runs, 12, runs * 12, timeout_seconds=5), adapter,
                           allow_live_replay=live, clock=lambda: ticks[0], sleep=sleep)
    def test_observe_only_never_clicks(self):
        a = Adapter(['Victory', 'Victory'])
        r = self.execute(a, live=False)
        self.assertEqual(len(r['runs']), 1)
        self.assertEqual(a.clicks, [])
        self.assertEqual(r['status'], 'paused')
    def test_live_replay_requires_battle_departure(self):
        a = Adapter(['Victory', 'Victory', 'Running', 'Victory', 'Victory'])
        r = self.execute(a)
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(a.clicks, ['Victory'])
        self.assertEqual(len(r['runs']), 2)
    def test_unchanged_result_is_not_counted_twice(self):
        a = Adapter(['Victory', 'Victory'])
        r = self.execute(a)
        self.assertEqual(len(r['runs']), 1)
        self.assertEqual(len(a.clicks), 1)
        self.assertIn('did not leave', r['reason'])
    def test_unknown_after_replay_does_not_prove_battle_start(self):
        a = Adapter(['Victory', 'Victory', 'Unknown'])
        r = self.execute(a)
        self.assertEqual(len(r['runs']), 1)
        self.assertIn('did not leave', r['reason'])
    def test_lost_foreground_never_clicks(self):
        a = Adapter(['Victory'], ready=False)
        self.assertEqual(self.execute(a)['status'], 'paused')
        self.assertEqual(a.clicks, [])
    def test_defeat_stops_by_default(self):
        a = Adapter(['Defeat', 'Defeat'])
        r = self.execute(a)
        self.assertEqual(len(r['runs']), 1)
        self.assertEqual(a.clicks, [])
    def test_manual_budget_is_enforced(self):
        with self.assertRaises(ValueError):
            run_session(RunPlan(2, 12, 12), Adapter([]))
    def test_ambiguous_screen_stops(self):
        a = Adapter(['Blocked'])
        self.assertEqual(self.execute(a)['status'], 'paused')
        self.assertEqual(a.clicks, [])


if __name__ == '__main__': unittest.main()
