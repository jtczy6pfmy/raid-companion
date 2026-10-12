"""PC-only calibrated replay preview; default mode never clicks."""
import argparse
import json
from pathlib import Path
import time
from replay_profile import make_patch, validate_profile
from windows_replay import WindowsReplay
from session_runner import RunPlan, run_session


def load_json(path):
    if path.stat().st_size > 10*1024*1024: raise ValueError('JSON file exceeds 10 MB')
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    temp = path.with_name(path.name + '.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    capture = sub.add_parser('calibrate', help='Capture a game-window patch after a focus countdown')
    capture.add_argument('--profile', type=Path, required=True)
    capture.add_argument('--state', choices=['Victory','Defeat','Running'], required=True)
    capture.add_argument('--region', type=int, nargs=4, required=True, metavar=('X','Y','W','H'))
    capture.add_argument('--replay-region', type=int, nargs=4)
    capture.add_argument('--replay-point', type=int, nargs=2)
    capture.add_argument('--delay', type=int, default=5)
    run = sub.add_parser('run', help='Observe a manually started battle, optionally replaying afterward')
    run.add_argument('--profile', type=Path, required=True)
    run.add_argument('--runs', type=int, required=True)
    run.add_argument('--energy-per-run', type=float, required=True)
    run.add_argument('--energy-budget', type=float, required=True)
    run.add_argument('--timeout', type=float, default=300)
    run.add_argument('--output', type=Path, required=True)
    run.add_argument('--live-replay', action='store_true')
    run.add_argument('--delay', type=int, default=5)
    args = parser.parse_args(argv)
    if not 0 <= args.delay <= 60: parser.error('Delay must be 0–60 seconds')
    plan = None
    profile = load_json(args.profile) if args.profile.exists() else None
    if profile: validate_profile(profile)
    if args.action == 'run':
        if not profile or not {'Victory','Running'}.issubset(profile['states']):
            parser.error('Calibrate distinct Victory, replay button and Running patches first')
        plan = RunPlan(args.runs, args.energy_per_run, args.energy_budget, args.timeout)
        plan.validate()
    elif args.state != 'Running' and (not args.replay_region or not args.replay_point):
        parser.error('A result state needs a replay button region and point')
    print(f'Focus RAID within {args.delay} seconds. Escape stops observation. No first battle or refill is started.')
    time.sleep(args.delay)
    adapter = WindowsReplay(profile)
    if args.action == 'calibrate':
        profile = profile or {'version':1,'client_size':adapter.size,'executable_sha256':adapter.fingerprint,'states':{}}
        state = {'patch':make_patch(args.region,adapter.capture(args.region))}
        if args.state != 'Running':
            state.update(replay_patch=make_patch(args.replay_region,adapter.capture(args.replay_region)),replay_point=args.replay_point)
        profile['states'][args.state] = state
        validate_profile(profile);write_json(args.profile,profile)
        print('Calibration saved locally. This does not validate game/account data or send a click.')
        return 0
    report = run_session(plan,adapter,allow_live_replay=args.live_replay,on_result=lambda r:write_json(args.output,r))
    print(report['status'] + ': ' + report['reason'])
    return 0 if report['status']=='complete' else 1


if __name__ == '__main__':
    try: raise SystemExit(main())
    except (ValueError,RuntimeError,OSError) as error:
        print('Runner stopped: ' + str(error));raise SystemExit(1)
