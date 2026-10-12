# Windows game reader: development milestone

This folder contains an installable **Windows Reader Preview** and a read-only connection probe. It is not a completed champion reader.

## Install the preview

Run `RAID-Companion-Reader-Preview-Setup-0.3.0-x64.exe` on Windows 10/11 x64. It includes Python, creates optional shortcuts, and can be removed through Windows Settings → Apps. No login is added. The installer uses the current Windows account and does not request administrator access.

Open RAID, launch the preview, then select **Check RAID connection**. If Windows denies read access, close the reader and run its shortcut as administrator; Windows asks for approval.

**Inspect memory samples** performs an experimental, bounded read of champion objects on the specifically supported game build. The build fingerprint is checked before using field offsets. It can return up to 24 champion IDs, type IDs, ranks, levels and available default names. The scan never writes game memory and excludes structurally invalid or conflicting samples. It is limited to 2 GiB and 100 seconds per scan pass. It may include stale or non-player objects: active-account roster membership, complete coverage and total stats are **not verified**. These samples are never imported into the web companion.

**Read roster candidates** reads all entries from stable champion dictionaries, checks each key against the champion ID, rejects duplicates and invalid fields, and repeats reads to reject changed snapshots. It includes locked/storage/reserve flags. A missing cached HeroType description is allowed; an invalid nonempty cache is rejected. It returned one 63-entry dictionary in the live test, matching the user-reported champion count. This corroborates the candidate but does not prove account identity or final stats. Names may be missing.

**Read gear candidates** performs bounded reads of artifact list and cached dictionary containers with basic IDs/ranks/levels/kinds/rarities/set IDs. The live cached-dictionary test returned 513 stable records after validating keys, unique IDs, counts and repeated snapshots. Account identity remains unverified. Equipped links and bonus stats are not implemented.

The reader dashboard does not sync account records, equip artifacts, sell items, or run battles. The bundled PC-only replay CLI is a separate calibrated preview: observation-only by default, with an explicit live-replay option. Its controller and calibration validation are unit tested, but actual RAID input and capture still need Windows game verification. See [REPLAY-PREVIEW.md](REPLAY-PREVIEW.md). Updated game builds need a validated reader update; the installer does not automatically adapt or update.

**Open web companion** opens the existing website in your normal browser, retaining that browser's own saved session. A different laptop/browser still has its own session and does not automatically inherit another device's cloud records. The native reader does not send data to the website or create a separate cloud identity. Diagnostic export is local; after sample inspection it includes the selected champion fields, not a raw memory dump. The preview is unsigned and has no automatic updater.

## Build the installer

Use 64-bit Python 3.14 and Inno Setup 6.7.3 on Windows. In an isolated Python environment, install `requirements-build.txt`. Run the UI status checks with `python test_reader_ui.py`, then run `build_windows.ps1` with `-PythonExe` pointing to that environment's Python and `-InnoCompiler` pointing to `ISCC.exe`. The script builds the app, includes runtime license notices, checks bundled startup, and compiles the installer into `installer-output/`. Generated binaries are excluded from Git.

## Probe directly

Run with 64-bit Python on Windows while RAID is open through Plarium Play:

```powershell
python desktop/raid_probe.py --output raid-probe.json
```

The probe finds exactly one `Raid.exe`, requests only process-query and memory-read access, and reads 64-byte executable headers from RAID, GameAssembly and UnityPlayer. It closes handles after use. It also reads the installed metadata file's eight-byte header. It does not request write/debug/injection rights, dump account memory, change the game, upload diagnostics, or connect to Supabase.

`memory_access_verified` means those module headers were read and validated. It explicitly does **not** mean champion data has been found. Exit status is zero only when RAID and GameAssembly headers were verified. Other results include game not running, multiple processes, access denied, or partial access.

Windows error 5 means Windows denied the requested process access. An administrator-approved run succeeded on the development PC; the normal run did not. Do not automatically disable protections or enable debug privileges to work around failures.

## Verified locally on October 10, 2026

- Live RAID and GameAssembly module header reads succeeded after Windows elevation approval.
- The experimental sample reader returned champion default names, IDs, ranks and levels from live memory. Membership and completeness remain unverified.
- A separate development test found a 63-entry dictionary on the derived UpdatableHeroData model. This is a candidate roster, not a validated complete account import.
- The packaged preview passed install, startup and uninstall checks; all eleven reader status/field validation tests passed.
- Installed Unity version: 6000.3.18f1; standard IL2CPP metadata version: 39.
- Official Cpp2IL `2022.1.0-pre-release.21` successfully parsed the installed metadata and located the binary code and metadata registrations. This is an offline analysis result, not a live account read.
- Generated schema contains `SharedModel.Meta.Heroes.Hero` with per-copy ID, type ID, grade and level fields, and `UserHeroData.HeroById` for the roster dictionary. These definitions alone do not identify the active player's objects in memory.

The next milestone is confirming account identity, filling the missing champion description, reading artifact bonuses/equipped links, and validating final champion stats against the game. A reader must verify the game build and reject unknown layouts before using offsets. Final champion stats, verified gear extraction, local dashboard transport, equipping and battle automation are not implemented.

Game binaries, generated game schema, user data and third-party analyzer executables stay outside the repository. The development analyzer's documented release is [Cpp2IL pre-release 21](https://github.com/SamboyCoding/Cpp2IL/releases/tag/2022.1.0-pre-release.21). Its executable SHA256 used locally was `663FB432433B4371FD1EE0EBC321A8FFF2A9AAC5AC4230C843F9E03DDEE4E04C` (recorded locally, not a publisher signature).

## Separate PC and iPadOS targets
The `desktop/` source and Windows installer are PC components. The deployed `site/` web app supports the iPadOS planning workflow. Do not treat the older root `index.html` as an established separate PC deployment without confirming its actual hosting path. Native controls are not added to the iPadOS UI.

The Windows build workflow tests reader UI/field validation plus replay controller/profile logic, compiles both executables and saves the installer as a workflow artifact. This does not validate account membership, final gear stats or live replay in RAID.
