# RAID Companion

Private, iPad-friendly RAID: Shadow Legends tracker, with no sign-in screen.

## Implemented
- Responsive static app in `index.html`
- Cheshire Cat baseline stats and candidate gear comparison
- Three Minotaur runs
- Notes stored locally with JSON export
- Searchable champion roster with add/edit forms for rank, level, ascension, and build notes
- Champion changes saved on the device immediately and synced to the existing private Supabase session; pending changes survive reloads and retry without creating duplicate champions
- Roster entries available in the iPad leveling planner, including maximum-rank handling for six-star champions
- Supabase cloud integration in `cloud.js`: automatic anonymous device session, owner-scoped RLS, initial champion/run records, notes sync with local fallback

## Supabase setup required
1. Open [Supabase Authentication Providers](https://supabase.com/dashboard/project/lavsuaojwyzavwtbgkcs/auth/providers).
2. **Enable Anonymous Sign-Ins**. This is required before cloud sync can connect.
3. Consider CAPTCHA / rate limiting to prevent abuse of anonymous account creation.
4. The migration `raid_companion_anonymous_device_rls` already added owner-scoped RLS policies to all six RAID tables.
5. Never expose secret or service-role keys. The frontend uses a **publishable** key only.

## Important device limitation
Anonymous sessions have no email/password and no login UI, but **clearing browser data or switching iPads can permanently lose access to the anonymous account's records**. Export JSON backups regularly. A recovery mechanism would require a separate future design.

## Run / deploy
Cloudflare serves `site/` through `wrangler.jsonc`. The root page and its companion modules are also maintained for the existing alternate static hosting workflow.

Serve `index.html`, `cloud.js`, `roster.js`, and `assets/` together over HTTPS (e.g. GitHub Pages if repository and plan support it, or a private hosting option). Opening raw source files from GitHub is not running the app. A public static URL does not itself make the app private; owner-scoped RLS protects records from other device sessions.

## Manage champions
Open **My Champions** to search, add, or edit entries. Rank sets the level cap (rank × 10) and the maximum ascension count. The existing Cheshire Cat entry keeps its name because it is linked to the dashboard snapshot; its notes are shared with the dashboard's notes field. The other champions can be renamed. Each name has one roster entry.

When cloud saves fail, the app keeps pending changes in device storage. **Retry cloud sync**, reconnecting to the network, or reloading the app retries them. Export includes all champion ranks, levels, ascension counts, and build notes, together with the existing baseline. If device storage is unavailable, export before closing the page. Do not clear browser data while changes are pending.

## Accuracy
Champion stats are prior screenshot baselines, not live game data. Candidate gear changes are not confirmed equipped. This is an unofficial fan tool and is not affiliated with Plarium.
