# Phase 1: champion roster and CSV import

## Public feature autopsy (reviewed 2026-10-09)
- HellHades: account extraction, gear search against desired stats, virtual equipment builds, team suggestions and roster-aware ratings. Some grading, comparison and team-detail features are premium. Sources: https://hellhades.com/how-to-use-the-artefact-optimizer-for-raid-shadow-legends/comment-page-1/ and https://accounts.hellhades.com/membership-faq/
- RSL Helper: champion index with name, level, faction, affinity and rarity filters; champion values and details; Windows autoclicker with count/event/potion/level/scroll stop conditions; energy refill, artifact selling, food leveling and forge automation; Clan Boss simulation and event/shard tracking. Its README explicitly states source code is not in the repository. Source: https://github.com/FarbstoffRSL/RSL-Helper
- Phase 1 adopts roster browsing and a user-supplied snapshot import. Optimization, ratings, combat simulation and automation require separate future implementations.

## Implemented
- My Champions screen with case-insensitive search across champion name, faction, affinity and rarity, counts and responsive cards.
- UTF-8 comma/semicolon CSV parsing, BOM, CRLF, quoted fields, embedded newlines and escaped quotes.
- Explicit column mapping: name required; instance ID, level, rank, faction, affinity and rarity optional. Unknown fields are not imported.
- All rows validate before a device write. Reject malformed quotes, duplicate/empty headers, inconsistent widths, duplicate instance IDs, invalid level/rank and oversized input. Duplicate names remain separate champions.
- Preview first five names and replacement count; mapping/file changes invalidate confirmation.
- Device roster replacement only after confirmation. Storage failures retain the in-memory roster; no cloud writes occur.
- Text-only rendering; imported HTML/formulas are inert. JSON backup export.
- Existing green/black iPad layout, dashboard, leveling planner, build paths, Minotaur and storage screens retained. Importer integrated into site/ (the Wrangler assets directory); root entry mirrors that layout. Imported champion summary reflects roster count.
- Both cloud.js copies and Supabase schema/auth/notes/snapshots/run workflows unchanged.

## Verification
Run: node roster-import.test.mjs
17 synthetic regression cases pass. roster-ui.mjs passes node syntax checking.

## Limitations
The requested /mnt/data/M@dM@rti@n-champions-2026-10-02.csv is not available in the Codex Windows workspace or referenced chat attachments. Its actual headers, encoding, row count and compatibility have NOT been verified. Mapping avoids inventing an RSL-Xtender schema, but the real export must still be tested.
Roster data is device-local, not synchronized through Supabase. Clearing browser data loses it. Backup JSON is for preservation; a JSON restore workflow is not implemented. Imports replace rather than merge the roster. Optional stats, gear, skills, ascension and other unknown columns are omitted. No champion catalog, ratings, optimization or autoclicker.
Browser/iPad visual QA and live Supabase regression verification have not been performed. Existing cloud.js is unchanged.
