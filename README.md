# RAID Companion

Full desktop dashboard for RAID: Shadow Legends, with responsive iPad and phone layouts and no sign-in screen.

## Implemented
- Full dashboard with the reference banner and sidebar, wider desktop panels, and identical `site/index.html` and root `index.html` pages
- Dashboard champion selector with per-copy build notes, imported total stats, labeled snapshot sources, and Cheshire Cat baseline fallback
- Candidate gear comparison
- Three Minotaur runs
- Notes stored locally with JSON export
- Searchable champion roster with add/edit forms for rank, level, ascension, and build notes
- Champion changes saved on the device immediately and synced to the existing private Supabase session; pending changes survive reloads and retry without creating duplicate champions
- Roster entries available in the leveling planner, including maximum-rank handling for six-star champions
- CSV import with a review step, separate champion copies, preserved build notes, and optional progress updates; original CSV details and stats are retained in private cloud storage and JSON export
- Supabase cloud integration in `cloud.js`: automatic anonymous device session, owner-scoped RLS, initial champion/run records, notes sync with local fallback

## Supabase setup required
1. Open [Supabase Authentication Providers](https://supabase.com/dashboard/project/lavsuaojwyzavwtbgkcs/auth/providers).
2. **Enable Anonymous Sign-Ins**. This is required before cloud sync can connect.
3. Consider CAPTCHA / rate limiting to prevent abuse of anonymous account creation.
4. The migration `raid_companion_anonymous_device_rls` already added owner-scoped RLS policies to all six RAID tables.
5. Never expose secret or service-role keys. The frontend uses a **publishable** key only.

## Important device limitation
Anonymous sessions have no email/password and no login UI, but **clearing browser data or switching browsers or devices can permanently lose access to the anonymous account's records**. Export JSON backups regularly. A recovery mechanism would require a separate future design.

## Run / deploy
Cloudflare serves `site/` through `wrangler.jsonc`. The root page and its companion modules are also maintained for the existing alternate static hosting workflow.

Serve `index.html`, `cloud.js`, `roster.js`, `csv-import.js`, and `assets/` together over HTTPS (e.g. GitHub Pages if repository and plan support it, or a private hosting option). Opening raw source files from GitHub is not running the app. A public static URL does not itself make the app private; owner-scoped RLS protects records from other device sessions.

## Manage champions
Open **My Champions** to search, add, or edit entries. Rank sets the level cap (rank × 10) and the maximum ascension count. The existing Cheshire Cat entry keeps its name because it is linked to the dashboard snapshot; its notes remain compatible with the original saved dashboard notes. The dashboard now selects any champion, including individual imported copies, and saves notes to that selected entry. Unsaved note drafts survive selection changes within the open page. Imported stats are labeled snapshots; champions without snapshots show unavailable values rather than another champion's stats. The other champions can be renamed. Imported copies are kept as separate entries and can be edited independently.

## Import a CSV roster
Choose **My Champions → Import CSV**, select a file with Name, Rank, and Level columns, then review the preview and confirm. Ascension defaults to zero when absent. All other columns, including rarity, affinity, faction, awakening, blessing, tomes, and base/total stats, are kept as an imported snapshot accessible on each card and in JSON export. CSV files are read in the browser; no user CSV is bundled with the website.

Existing build notes are always preserved. Existing ranks, levels, and ascension are kept unless **Update existing ranks, levels and ascension from this file** is checked. Dorothy and Vallyarn starting entries match Dorothy Gale and Vallaryn the Equalizer. Copies are identified by name and occurrence order because this export has no individual champion ID; review the preview when the ordering or number of copies changes. Repeat imports update matching copies rather than adding duplicates. Champions absent from the file remain in the roster.

The database changes are recorded in `schema/champion-import.sql`, which was applied to the hosted project. Imported copies use unique import keys; manual entries retain unique names within each device session. Owner-scoped access policies remain in place. Run `node --test tests/csv-import.test.mjs` for parser and merge checks.

When cloud saves fail, the app keeps pending changes in device storage. **Retry cloud sync**, reconnecting to the network, or reloading the app retries them. Export includes all champion ranks, levels, ascension counts, and build notes, together with the existing baseline. If device storage is unavailable, export before closing the page. Do not clear browser data while changes are pending.

## Accuracy
Champion stats are prior screenshot baselines, not live game data. Candidate gear changes are not confirmed equipped. This is an unofficial fan tool and is not affiliated with Plarium.

## Companion toolkit
The champion index filters imported rarity, affinity and faction, plus current rank and leveling status. Sort by level, rank, speed, accuracy, HP or crit damage; unavailable stats sort last.

Build Lab saves named per-copy plans with a role, preferred sets, minimum stat targets, optional candidate total stats and notes. Blank candidate fields use the current snapshot. Comparisons show numeric differences between saved snapshots. There is no artifact extraction, automatic gear selection, in-game equipment change or verified champion-rating database.

Team Planner saves up to six distinct champion copies, with the first slot as leader and unused slots left empty. Snapshot speed order is a planning aid, not a combat or speed-tune simulation. Battle Log records manual results, optional team snapshots, duration, energy and notes; performance summaries use only those logged results. Session estimates multiply the user's run count, energy and duration inputs. The original three Minotaur records remain visible in the roster section, separate from the new manually entered battle log.

Builds, teams and battles persist in `raid-companion-tools-v1` and retry private cloud upserts to `raid_companion_plans`. Cloud records retain deletion tombstones to avoid restoring removed plans; each plan ID has its own pending queue entry. Local pending records are retained during reconnect. The schema in `schema/companion-plans.sql` is additive and restricts SELECT/INSERT/UPDATE to the owning device session. Existing champion, run and inventory tables are not altered. JSON exports include the toolkit records.

The web companion is inspired by the organisation and planning workflows of HellHades and RSL Helper. It has no affiliation with either, no login screen, and no native RAID game connection or auto-battle functionality.

## Complete progression production plan
The deployed Leveling Lab loads the pure progression engine and shows ordered leveling, rank-up and selected ascension steps. Recursive food totals include both promoted base champions and their sacrifices. Rows are successive production stages, not additive requirements; existing food and chickens are not deducted from fresh-start totals. Food advice protects saved team copies, favorites, fusion reservations and high-rarity champions and reads imported rarity metadata. Supplied scores sort ascending; missing scores remain unranked. No roster data is replaced by this update.

## Artifact optimiser and run sessions
Artifact Optimiser accepts a reviewed version-1 inventory JSON or manually entered pieces. Each piece has a unique ID, an equipment slot, flat bonuses, optional base-percentage bonuses, set name, equipped copy ID, protection flag and optional faction. Download the format from the optimiser. Accessories can be included as a nine-slot search; faction-restricted pieces require a matching champion faction in the roster import. Set definitions must be supplied with piece counts and stat bonuses; unknown set names contribute no set bonus.

Enter all eight unequipped stats for the selected champion copy. Minimum/maximum targets, stat weights, pinned IDs and required completed sets constrain the search. Permanent bonuses may be included in the unequipped values; skills, conditional effects and multi-tier set effects are not simulated. Searches up to 200,000 combinations are exhaustive. Larger inventories use per-slot shortlists and a bounded beam, with every result explicitly labeled approximate. Optimality is not guaranteed for those results. Narrowing with pins/exclusions can make the search exhaustive.

Protected pieces and other champions' equipment are excluded by default. Other saved loadouts reserve their pieces by default; this can be disabled. Overlapping saved plans display shared-artifact warnings. Saved loadouts do not equip gear or update champion snapshots.

Run Session Companion plans an affordable run count from energy budget, run cost and estimated duration. Each completed battle is recorded manually. Victories and defeats both count toward expenditure and completion. Sessions persist locally, allow undoing the last entry, and export with timestamps. No automatic battles, game control, refills or live resource reading occur.

## Workbench persistence
Inventory, loadouts and sessions save locally and sync to the existing private device session through `raid_companion_workbench`. Owner-scoped RLS protects the snapshot. Revision checks reject stale writes; a three-way merge combines independent edits and asks which conflicting records to keep when both copies changed. Pending changes stay local when cloud saving fails. Workbench sync does not change champion, run or old plan tables. The additive schema is recorded in `schema/workbench.sql`; the rolled-back ownership/stale-write checks are in `schema/workbench-rls-check.sql`.

Storage also provides a reviewed backup restore that adds missing artifact IDs, set definitions, loadouts and sessions while preserving existing records. Champion exports retain per-copy IDs so references remain usable. Device sessions still cannot automatically transfer between browsers or devices.

All 54 existing archive portraits also ship as direct assets, with aliases for full champion names. Portrait loading does not download JSZip or extract a ZIP at runtime.

## Windows reader boundary
Storage accepts Windows Reader diagnostic reports for review, without importing unverified candidate objects or treating them as usable gear. Live account verification, complete gear bonuses/equipped links, automatic equipping and verified battle control still require development and verification on Windows with RAID running. The PC source now includes a calibrated replay CLI preview with an observation-only default, bounded session controller, foreground/build/geometry guards and Escape stop; this is not validated live RAID automation. The web app does not claim those features.

## Verification
Run `npm ci`, `npm test`, and `npm run test:dom`. DOM integration checks preserve a synthetic 65-copy roster while exercising progression, inventory changes, session logging, optimiser results and saved loadouts. The happy-dom checks verify interaction logic, not browser visual layout or a live RAID connection.
