# Windows game reader: development milestone

This folder contains a read-only connection probe, not an installable companion or a completed champion reader.

Run with 64-bit Python on Windows while RAID is open through Plarium Play:

```powershell
python desktop/raid_probe.py --output raid-probe.json
```

The probe finds exactly one `Raid.exe`, requests only process-query and memory-read access, and reads 64-byte executable headers from RAID, GameAssembly and UnityPlayer. It closes handles after use. It also reads the installed metadata file's eight-byte header. It does not request write/debug/injection rights, dump account memory, change the game, upload diagnostics, or connect to Supabase.

`memory_access_verified` means those module headers were read and validated. It explicitly does **not** mean champion data has been found. Exit status is zero only when RAID and GameAssembly headers were verified. Other results include game not running, multiple processes, access denied, or partial access.

Windows error 5 means Windows denied the requested process access. An administrator-approved run succeeded on the development PC; the normal run did not. Do not automatically disable protections or enable debug privileges to work around failures.

## Verified locally on October 10, 2026

- Live RAID and GameAssembly module header reads succeeded after Windows elevation approval.
- Installed Unity version: 6000.3.18f1; standard IL2CPP metadata version: 39.
- Official Cpp2IL `2022.1.0-pre-release.21` successfully parsed the installed metadata and located the binary code and metadata registrations. This is an offline analysis result, not a live account read.
- Generated schema contains `SharedModel.Meta.Heroes.Hero` with per-copy ID, type ID, grade and level fields, and `UserHeroData.HeroById` for the roster dictionary. These definitions alone do not identify the active player's objects in memory.

The next milestone is locating the active account's roster dictionary and validating a champion's ID, level and stats against the game. A reader must verify the game build and reject unknown layouts before using offsets. Champion extraction, local dashboard transport, equipping and battle automation are not implemented.

Game binaries, generated game schema, user data and third-party analyzer executables stay outside the repository. The development analyzer's documented release is [Cpp2IL pre-release 21](https://github.com/SamboyCoding/Cpp2IL/releases/tag/2022.1.0-pre-release.21). Its executable SHA256 used locally was `663FB432433B4371FD1EE0EBC321A8FFF2A9AAC5AC4230C843F9E03DDEE4E04C` (recorded locally, not a publisher signature).
