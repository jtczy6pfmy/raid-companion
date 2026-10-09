# RAID Companion

Private, iPad-friendly RAID: Shadow Legends champion and dungeon tracker.

## Product requirements
- **No sign-in screen or login prompts.** Open directly to the dashboard.
- Single-user experience optimized for iPad.
- No public registration or multi-user account management.

## Phase 1
- Responsive zero-build web app in `index.html`
- Cheshire Cat baseline profile and stat dashboard
- Chestplate and gauntlet candidate comparison
- Minotaur Stage 12/13 history
- Local note storage and JSON export

## Run
Open `index.html` in a browser or deploy it with a static hosting provider. A GitHub repository does not automatically publish a website.

## Planned Supabase backend
Repurpose the existing Chassis Parts Inventory Supabase project after it becomes active and its schema is inspected.

**Security design:** No login UI does not mean unrestricted database access. Do not expose a Supabase service-role key or secret in browser code, and do not allow anonymous public writes to champion tables. Cloud sync will require a protected server-side gateway or another private-access mechanism. Until that mechanism is implemented, keep edits local on the device. Never commit secrets.

## Accuracy
Champion stats are an older observed baseline, not live game data. Gear recommendations are candidates, not confirmed equipment changes. Unofficial fan tool, not affiliated with Plarium.
