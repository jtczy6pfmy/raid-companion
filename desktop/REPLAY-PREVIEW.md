# PC replay preview — calibration required

This is the PC-only replay component. The iPadOS companion retains roster, optimiser and planning tools. This preview does not verify the live account, extract final champion stats, equip gear or read actual energy. Windows game testing is still required.

The CLI defaults to observation only. Live replay requires the explicit `--live-replay` switch and valid screen calibration. Start the first battle manually in RAID. The runner never starts that first battle, buys refills, uses gems or changes teams. Press Escape or switch away from RAID to stop. Each result must match twice; replay must leave the result screen and match a calibrated Running patch before another result can count. Timeouts and ambiguous screens stop input.

Use the installed `battle-runner/RAIDCompanionBattleRunner.exe`, or run `python desktop/battle_runner.py` from source. `--help` lists arguments. All coordinates are physical pixels inside the RAID client area; they must be measured on your PC. There are no preset coordinates.

Calibrate a distinctive Victory label/icon rectangle and its replay button rectangle/point while the result screen is displayed. Calibrate a distinctive Running icon rectangle during a battle. Optional Defeat calibration stops the session on loss. Each calibration command gives five seconds to focus RAID before capturing. Uniform patches, changed game executable, changed window dimensions and points outside the calibrated replay button are rejected.

Command structure (replace every coordinate placeholder with measured integers):

```text
RAIDCompanionBattleRunner.exe calibrate --profile raid-replay-profile.json --state Victory --region X Y W H --replay-region X Y W H --replay-point X Y
RAIDCompanionBattleRunner.exe calibrate --profile raid-replay-profile.json --state Running --region X Y W H
RAIDCompanionBattleRunner.exe run --profile raid-replay-profile.json --runs 5 --energy-per-run 12 --energy-budget 60 --output raid-session-report.json
```

The last command sends no clicks. Adding `--live-replay` enables only the calibrated replay action. Observe-only behavior should be validated on the actual PC before live replay is used. Windows may reject input to an elevated game; the runner stops and does not attempt to bypass or change process permissions.

Reports save locally after each observed result. Durations are observation windows, and energy is planned/manual; neither is presented as a live game measurement. Reports contain no raw process memory, account credentials or cloud upload.
