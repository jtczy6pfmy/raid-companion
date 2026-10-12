"""Bounded native session controller. UI access is supplied by a platform adapter."""
from dataclasses import dataclass
import math
import time


@dataclass(frozen=True)
class RunPlan:
    runs: int
    energy_per_run: float
    energy_budget: float
    timeout_seconds: float = 300
    stop_on_defeat: bool = True

    def validate(self):
        if isinstance(self.runs, bool) or not isinstance(self.runs, int) or not 1 <= self.runs <= 10000:
            raise ValueError('Runs must be 1–10,000')
        for value in (self.energy_per_run, self.energy_budget, self.timeout_seconds):
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError('Energy and timeout must be finite numbers')
        if self.energy_per_run < 0 or self.energy_budget < 0 or not 5 <= self.timeout_seconds <= 3600:
            raise ValueError('Invalid energy or timeout')
        if self.energy_per_run * self.runs > self.energy_budget:
            raise ValueError('Planned runs exceed the manual energy budget')


def run_session(plan, adapter, *, allow_live_replay=False, clock=time.monotonic,
                sleep=time.sleep, on_result=lambda report: None, poll_seconds=0.5):
    """Observe the first manually started battle, then optionally replay.

    Adapter.observe returns Victory, Defeat, Running, Unknown or Blocked.
    Adapter.replay must recheck foreground, calibration and result immediately.
    No energy refills, team edits, gear changes or automatic first battle.
    """
    plan.validate()
    records = []
    report = {'version': 1, 'source': 'raid-native-session', 'status': 'observing',
              'mode': 'live_replay' if allow_live_replay else 'observe_only',
              'planned_runs': plan.runs, 'energy_source': 'manual_plan', 'runs': records,
              'reason': '', 'account_verified': False}
    started = clock()
    previous_result = None
    stable = 0
    waiting_for_departure = False
    departure_started = None

    def finish(status, reason):
        report.update(status=status, reason=reason,
                      planned_energy_used=len(records) * plan.energy_per_run)
        on_result(report)
        return report

    while len(records) < plan.runs:
        if adapter.stop_requested():
            return finish('stopped', 'Stop requested')
        if not adapter.ready():
            return finish('paused', 'RAID lost foreground, window geometry or build calibration')
        now = clock()
        if waiting_for_departure and now - departure_started >= 15:
            return finish('paused', 'Replay did not leave the result screen; no further clicks sent')
        if not waiting_for_departure and now - started >= plan.timeout_seconds:
            return finish('paused', 'Battle observation timed out; check RAID manually')
        try:
            observed = adapter.observe()
        except Exception as error:
            return finish('paused', 'Observation failed: ' + str(error))
        if observed == 'Blocked':
            return finish('paused', 'Unrecognized or ambiguous screen; check RAID manually')
        if waiting_for_departure:
            # Unknown is not proof of a battle starting (it might be a refill dialog).
            if observed == 'Running':
                waiting_for_departure = False
                started = now
                previous_result = None
                stable = 0
            sleep(poll_seconds)
            continue
        if observed not in ('Victory', 'Defeat'):
            stable = 0
            previous_result = None
            sleep(poll_seconds)
            continue
        stable = stable + 1 if observed == previous_result else 1
        previous_result = observed
        if stable < 2:
            sleep(poll_seconds)
            continue
        records.append({'result': observed, 'observed_seconds': round(max(0, now - started), 3),
                        'duration_kind': 'observation_window', 'planned_energy': plan.energy_per_run})
        report['planned_energy_used'] = len(records) * plan.energy_per_run
        on_result(report)
        if len(records) == plan.runs:
            return finish('complete', 'Requested run count observed')
        if observed == 'Defeat' and plan.stop_on_defeat:
            return finish('paused', 'Defeat observed; review the team before continuing')
        if not allow_live_replay:
            return finish('paused', 'Observe-only mode; no replay click sent')
        if adapter.stop_requested() or not adapter.ready():
            return finish('paused', 'Stop or foreground change before replay')
        try:
            if not adapter.replay(observed):
                return finish('paused', 'Result or replay calibration changed; no click sent')
        except Exception as error:
            return finish('paused', 'Replay failed: ' + str(error))
        waiting_for_departure = True
        departure_started = clock()
        stable = 0
        sleep(poll_seconds)
    return finish('complete', 'Requested run count observed')
