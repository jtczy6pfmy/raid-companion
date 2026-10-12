# RAID Companion platform branches

| Version | Development branch | Source | Deployment |
| --- | --- | --- | --- |
| iPadOS | `ipados` | `site/` web app | GitHub Pages workflow deploys only pushes/manual runs on `ipados` |
| PC | `main` | PC components in `desktop/`; separate PC web entry point has not been verified | Windows installer workflow remains on `main` |

Each branch retains its own repository history and may include shared code. iPadOS changes belong on `ipados`; PC changes belong on `main`. Do not merge either entire branch into the other for routine updates. Port only intentional shared changes.

The Pages deployment keeps the existing public URL and app storage keys. Deployment metadata at `/raid-companion/deployment.json` identifies the deployed platform, branch and commit. The default-branch workflow definition also targets only `ipados`, so a `main` push or manual run on `main` cannot replace the iPadOS Pages app.

## Cloudflare production branch — separate hosting setting

The existing `raid-companion` Worker must also be changed to use `ipados` in Cloudflare: Workers & Pages → raid-companion → Settings → Build → Branch control → Production branch → ipados. This hosting setting is not changed by editing a GitHub workflow or by creating a branch. Dashboard access was unavailable during this migration; do not claim the Cloudflare branch has been switched until verified there.
