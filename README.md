# RAID Companion

Private, iPad-friendly RAID: Shadow Legends tracker, with no sign-in screen.

## Implemented
- Responsive static app in `index.html`
- Cheshire Cat baseline stats and candidate gear comparison
- Three Minotaur runs
- Notes stored locally with JSON export
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
Serve `index.html` and `cloud.js` from the same static site over HTTPS (e.g. GitHub Pages if repository and plan support it, or a private hosting option). Opening raw source files from GitHub is not running the app. A public static URL does not itself make the app private; owner-scoped RLS protects records from other device sessions.

## Accuracy
Champion stats are prior screenshot baselines, not live game data. Candidate gear changes are not confirmed equipped. This is an unofficial fan tool and is not affiliated with Plarium.
